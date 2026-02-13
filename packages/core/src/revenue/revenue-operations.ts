export interface SubscriptionPlan {
  id: string
  name: string
  price: number
  billingCycle: 'monthly' | 'annually'
  features: string[]
  limits: Record<string, number>
}

export interface Subscription {
  id: string
  userId: string
  planId: string
  status: 'active' | 'paused' | 'cancelled'
  startDate: Date
  renewalDate: Date
  autoRenew: boolean
}

export interface Invoice {
  id: string
  subscriptionId: string
  userId: string
  amount: number
  status: 'pending' | 'paid' | 'overdue' | 'failed'
  issuedDate: Date
  dueDate: Date
  paidDate?: Date
}

export interface RevenueMetrics {
  mrr: number // Monthly Recurring Revenue
  arr: number // Annual Recurring Revenue
  churnValue: number
  ltv: number // Lifetime Value
  cac: number // Customer Acquisition Cost
  paybackPeriod: number
  grossProfit: number
  netProfit: number
}

export class RevenueOperations {
  private plans: Map<string, SubscriptionPlan> = new Map()
  private subscriptions: Map<string, Subscription> = new Map()
  private invoices: Map<string, Invoice> = new Map()
  private operatingCosts: number = 0

  constructor() {
    this.initializeDefaultPlans()
  }

  private initializeDefaultPlans(): void {
    // Starter plan
    this.plans.set('starter', {
      id: 'starter',
      name: 'Starter',
      price: 29,
      billingCycle: 'monthly',
      features: ['Basic agents', 'Limited code generation', 'Community support'],
      limits: { agents: 5, monthlyRequests: 1000, storage: 10 }
    })

    // Professional plan
    this.plans.set('professional', {
      id: 'professional',
      name: 'Professional',
      price: 99,
      billingCycle: 'monthly',
      features: ['Advanced agents', 'Full code generation', 'Email support', 'API access'],
      limits: { agents: 50, monthlyRequests: 100000, storage: 100 }
    })

    // Enterprise plan
    this.plans.set('enterprise', {
      id: 'enterprise',
      name: 'Enterprise',
      price: 999,
      billingCycle: 'monthly',
      features: [
        'Unlimited agents',
        'Full customization',
        'Dedicated support',
        'SLA guarantee',
        'Custom integration'
      ],
      limits: { agents: -1, monthlyRequests: -1, storage: -1 }
    })
  }

  /**
   * Create subscription
   */
  createSubscription(userId: string, planId: string): Subscription | null {
    const plan = this.plans.get(planId)
    if (!plan) return null

    const subscriptionId = `sub-${Date.now()}`
    const now = new Date()
    let renewalDate = new Date(now)

    if (plan.billingCycle === 'monthly') {
      renewalDate.setMonth(renewalDate.getMonth() + 1)
    } else {
      renewalDate.setFullYear(renewalDate.getFullYear() + 1)
    }

    const subscription: Subscription = {
      id: subscriptionId,
      userId,
      planId,
      status: 'active',
      startDate: now,
      renewalDate,
      autoRenew: true
    }

    this.subscriptions.set(subscriptionId, subscription)

    // Create initial invoice
    this.createInvoice(subscriptionId, userId, plan.price)

    console.log(`💳 Revenue: Subscription ${subscriptionId} created`)
    return subscription
  }

  /**
   * Cancel subscription
   */
  cancelSubscription(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId)
    if (!subscription) return false

    subscription.status = 'cancelled'
    subscription.autoRenew = false

    console.log(`❌ Revenue: Subscription ${subscriptionId} cancelled`)
    return true
  }

  /**
   * Pause subscription
   */
  pauseSubscription(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId)
    if (!subscription) return false

    subscription.status = 'paused'
    console.log(`⏸️ Revenue: Subscription ${subscriptionId} paused`)
    return true
  }

  /**
   * Resume subscription
   */
  resumeSubscription(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId)
    if (!subscription) return false

    subscription.status = 'active'
    console.log(`▶️ Revenue: Subscription ${subscriptionId} resumed`)
    return true
  }

  /**
   * Upgrade subscription plan
   */
  upgradeSubscription(subscriptionId: string, newPlanId: string): Subscription | null {
    const subscription = this.subscriptions.get(subscriptionId)
    const newPlan = this.plans.get(newPlanId)

    if (!subscription || !newPlan) return null

    subscription.planId = newPlanId
    console.log(`⬆️ Revenue: Subscription ${subscriptionId} upgraded to ${newPlanId}`)

    return subscription
  }

  /**
   * Create invoice
   */
  private createInvoice(subscriptionId: string, userId: string, amount: number): Invoice {
    const invoiceId = `inv-${Date.now()}`
    const now = new Date()
    const dueDate = new Date(now)
    dueDate.setDate(dueDate.getDate() + 30) // 30 days to pay

    const invoice: Invoice = {
      id: invoiceId,
      subscriptionId,
      userId,
      amount,
      status: 'pending',
      issuedDate: now,
      dueDate
    }

    this.invoices.set(invoiceId, invoice)
    return invoice
  }

  /**
   * Mark invoice as paid
   */
  payInvoice(invoiceId: string): boolean {
    const invoice = this.invoices.get(invoiceId)
    if (!invoice) return false

    invoice.status = 'paid'
    invoice.paidDate = new Date()

    console.log(`✅ Revenue: Invoice ${invoiceId} paid`)
    return true
  }

  /**
   * Get user subscriptions
   */
  getUserSubscriptions(userId: string): Subscription[] {
    return Array.from(this.subscriptions.values()).filter((s) => s.userId === userId)
  }

  /**
   * Get subscription details
   */
  getSubscriptionDetails(subscriptionId: string): {
    subscription: Subscription | null
    plan: SubscriptionPlan | null
  } {
    const subscription = this.subscriptions.get(subscriptionId)
    const plan = subscription ? this.plans.get(subscription.planId) : null

    return { subscription, plan }
  }

  /**
   * Get user invoices
   */
  getUserInvoices(userId: string): Invoice[] {
    return Array.from(this.invoices.values()).filter((i) => i.userId === userId)
  }

  /**
   * Set operating costs
   */
  setOperatingCosts(costs: number): void {
    this.operatingCosts = costs
  }

  /**
   * Calculate revenue metrics
   */
  calculateMetrics(): RevenueMetrics {
    const activeSubscriptions = Array.from(this.subscriptions.values()).filter(
      (s) => s.status === 'active'
    )

    const paidInvoices = Array.from(this.invoices.values()).filter((i) => i.status === 'paid')

    // MRR - Monthly Recurring Revenue
    const mrr = activeSubscriptions.reduce((sum, sub) => {
      const plan = this.plans.get(sub.planId)
      const monthlyPrice =
        plan && plan.billingCycle === 'monthly' ? plan.price : (plan?.price || 0) / 12
      return sum + monthlyPrice
    }, 0)

    // ARR - Annual Recurring Revenue
    const arr = mrr * 12

    // Churn value - revenue lost from cancelled subscriptions
    const cancelledSubscriptions = Array.from(this.subscriptions.values()).filter(
      (s) => s.status === 'cancelled'
    )
    const churnValue = cancelledSubscriptions.reduce((sum, sub) => {
      const plan = this.plans.get(sub.planId)
      return sum + (plan?.price || 0)
    }, 0)

    // LTV - Lifetime Value (assuming average customer lifetime of 3 years)
    const avgCustomerLifetime = 36 // months
    const ltv = mrr * avgCustomerLifetime * 0.7 // 0.7 = assumed profit margin

    // CAC - Customer Acquisition Cost (simplified)
    const cac = (this.operatingCosts / (activeSubscriptions.length || 1)) * 0.25 // 25% of costs to acquisition

    // Payback period in months
    const paybackPeriod = cac > 0 ? cac / (mrr / activeSubscriptions.length || 1) : 0

    // Profits
    const totalRevenue = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0)
    const grossProfit = totalRevenue - churnValue
    const netProfit = grossProfit - this.operatingCosts

    return {
      mrr,
      arr,
      churnValue,
      ltv,
      cac,
      paybackPeriod,
      grossProfit,
      netProfit
    }
  }

  /**
   * Get plan details
   */
  getPlan(planId: string): SubscriptionPlan | null {
    return this.plans.get(planId) || null
  }

  /**
   * List all plans
   */
  listPlans(): SubscriptionPlan[] {
    return Array.from(this.plans.values())
  }

  /**
   * Get subscription count by plan
   */
  getSubscriptionCountByPlan(): Record<string, number> {
    const counts: Record<string, number> = {}

    for (const sub of this.subscriptions.values()) {
      counts[sub.planId] = (counts[sub.planId] || 0) + 1
    }

    return counts
  }

  /**
   * Get revenue by plan
   */
  getRevenueByPlan(): Record<string, number> {
    const revenue: Record<string, number> = {}

    for (const invoice of this.invoices.values()) {
      if (invoice.status === 'paid') {
        const sub = this.subscriptions.get(invoice.subscriptionId)
        if (sub) {
          revenue[sub.planId] = (revenue[sub.planId] || 0) + invoice.amount
        }
      }
    }

    return revenue
  }
}
