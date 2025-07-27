import { v4 as uuidv4 } from 'uuid'
import { supabase } from '../supabase'
import type { CoordinationMessage } from '../supabase'

export interface AgentConfig {
  id: string
  name: string
  type: 'master' | 'district' | 'fleet' | 'intersection'
  priority: number
}

export interface Message {
  msg_id: string
  timestamp: string
  sender: string
  recipient: string
  message_type: 'proposal' | 'acceptance' | 'rejection' | 'info' | 'emergency'
  priority: number
  payload: any
  ttl: number
}

export abstract class BaseAgent {
  protected config: AgentConfig
  protected messageHandlers: Map<string, (msg: Message) => Promise<void>>
  protected isActive: boolean = false

  constructor(config: AgentConfig) {
    this.config = config
    this.messageHandlers = new Map()
    this.setupMessageHandlers()
  }

  abstract setupMessageHandlers(): void
  abstract processMessage(message: Message): Promise<void>
  abstract makeDecision(context: any): Promise<any>

  async start() {
    this.isActive = true
    console.log(`${this.config.name} agent started`)
    await this.subscribeToMessages()
  }

  async stop() {
    this.isActive = false
    console.log(`${this.config.name} agent stopped`)
  }

  protected async subscribeToMessages() {
    const channel = supabase
      .channel(`agent-${this.config.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'coordination_messages',
          filter: `recipient=eq.${this.config.id}`
        },
        async (payload) => {
          if (this.isActive) {
            const message = payload.new as CoordinationMessage
            await this.handleIncomingMessage({
              msg_id: message.msg_id,
              timestamp: message.timestamp,
              sender: message.sender,
              recipient: message.recipient,
              message_type: message.message_type,
              priority: message.priority,
              payload: message.payload,
              ttl: message.ttl
            })
          }
        }
      )
      .subscribe()
  }

  protected async handleIncomingMessage(message: Message) {
    // Check if message is still valid (TTL)
    const messageAge = Date.now() - new Date(message.timestamp).getTime()
    if (messageAge > message.ttl * 1000) {
      console.log(`Message ${message.msg_id} expired`)
      await this.updateMessageStatus(message.msg_id, 'expired')
      return
    }

    // Process message
    await this.processMessage(message)
    await this.updateMessageStatus(message.msg_id, 'delivered')
  }

  protected async sendMessage(
    recipient: string,
    messageType: Message['message_type'],
    payload: any,
    priority: number = 5,
    ttl: number = 60
  ): Promise<void> {
    const message: Omit<CoordinationMessage, 'id' | 'status' | 'created_at'> = {
      msg_id: uuidv4(),
      timestamp: new Date().toISOString(),
      sender: this.config.id,
      recipient,
      message_type: messageType,
      priority,
      payload,
      ttl
    }

    const { error } = await supabase
      .from('coordination_messages')
      .insert([message])

    if (error) {
      console.error('Error sending message:', error)
    }
  }

  protected async broadcast(
    recipients: string[],
    messageType: Message['message_type'],
    payload: any,
    priority: number = 5
  ): Promise<void> {
    await Promise.all(
      recipients.map(recipient =>
        this.sendMessage(recipient, messageType, payload, priority)
      )
    )
  }

  protected async updateMessageStatus(msgId: string, status: 'delivered' | 'expired') {
    const { error } = await supabase
      .from('coordination_messages')
      .update({ status })
      .eq('msg_id', msgId)

    if (error) {
      console.error('Error updating message status:', error)
    }
  }

  // Consensus mechanism
  protected async gatherConsensus(
    proposal: any,
    participants: string[],
    timeoutMs: number = 5000
  ): Promise<{ approved: boolean; responses: Map<string, boolean> }> {
    const proposalId = uuidv4()
    const responses = new Map<string, boolean>()
    
    // Send proposal to all participants
    await this.broadcast(participants, 'proposal', {
      proposalId,
      proposal,
      timeout: timeoutMs
    }, 10)

    // Wait for responses
    const startTime = Date.now()
    while (Date.now() - startTime < timeoutMs) {
      // Check for responses in database
      const { data } = await supabase
        .from('coordination_messages')
        .select('*')
        .or('message_type.eq.acceptance,message_type.eq.rejection')
        .eq('payload->proposalId', proposalId)

      if (data) {
        data.forEach(msg => {
          responses.set(msg.sender, msg.message_type === 'acceptance')
        })
      }

      // Check if we have enough responses (70% quorum)
      if (responses.size >= Math.ceil(participants.length * 0.7)) {
        break
      }

      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // Calculate consensus (51% majority)
    const approvals = Array.from(responses.values()).filter(v => v).length
    const approved = approvals >= Math.ceil(responses.size * 0.51)

    return { approved, responses }
  }
}
