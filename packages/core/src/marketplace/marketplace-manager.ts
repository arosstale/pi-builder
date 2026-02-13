export interface MarketplaceProduct {
  id: string
  name: string
  description: string
  category: string
  version: string
  author: string
  price: number
  rating: number
  downloads: number
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

export interface ListingStats {
  totalProducts: number
  totalDownloads: number
  totalRevenue: number
  averageRating: number
  topProducts: string[]
}

export interface UserListing {
  userId: string
  productId: string
  title: string
  description: string
  category: string
  price: number
}

export interface PurchaseRecord {
  id: string
  userId: string
  productId: string
  amount: number
  timestamp: Date
  status: 'completed' | 'pending' | 'failed'
}

export class MarketplaceManager {
  private products: Map<string, MarketplaceProduct> = new Map()
  private purchases: Map<string, PurchaseRecord> = new Map()
  private userListings: Map<string, UserListing[]> = new Map()

  constructor() {}

  /**
   * Create a new product listing
   */
  async createListing(listing: UserListing): Promise<MarketplaceProduct> {
    const id = `product-${Date.now()}`
    const product: MarketplaceProduct = {
      id,
      name: listing.title,
      description: listing.description,
      category: listing.category,
      version: '1.0.0',
      author: listing.userId,
      price: listing.price,
      rating: 0,
      downloads: 0,
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }

    this.products.set(id, product)

    // Track user listing
    if (!this.userListings.has(listing.userId)) {
      this.userListings.set(listing.userId, [])
    }
    this.userListings.get(listing.userId)!.push(listing)

    console.log(`📦 Marketplace: Created listing ${id}`)
    return product
  }

  /**
   * Get product listing
   */
  getProduct(productId: string): MarketplaceProduct | null {
    return this.products.get(productId) || null
  }

  /**
   * Search products
   */
  searchProducts(query: string, category?: string): MarketplaceProduct[] {
    return Array.from(this.products.values()).filter((product) => {
      const matchesQuery =
        product.name.toLowerCase().includes(query.toLowerCase()) ||
        product.description.toLowerCase().includes(query.toLowerCase())

      const matchesCategory = !category || product.category === category

      return matchesQuery && matchesCategory
    })
  }

  /**
   * Get featured products (top rated)
   */
  getFeaturedProducts(limit: number = 10): MarketplaceProduct[] {
    return Array.from(this.products.values())
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limit)
  }

  /**
   * Get trending products (most downloads)
   */
  getTrendingProducts(limit: number = 10): MarketplaceProduct[] {
    return Array.from(this.products.values())
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, limit)
  }

  /**
   * Purchase a product
   */
  async purchaseProduct(userId: string, productId: string): Promise<PurchaseRecord | null> {
    const product = this.products.get(productId)
    if (!product) return null

    const purchaseId = `purchase-${Date.now()}`
    const purchase: PurchaseRecord = {
      id: purchaseId,
      userId,
      productId,
      amount: product.price,
      timestamp: new Date(),
      status: 'completed'
    }

    this.purchases.set(purchaseId, purchase)

    // Update product stats
    product.downloads++
    product.updatedAt = new Date()

    console.log(`💳 Marketplace: Purchase ${purchaseId} completed`)
    return purchase
  }

  /**
   * Rate a product
   */
  rateProduct(productId: string, rating: number): boolean {
    const product = this.products.get(productId)
    if (!product) return false

    if (rating < 0 || rating > 5) return false

    product.rating = (product.rating + rating) / 2
    product.updatedAt = new Date()

    console.log(`⭐ Marketplace: Product ${productId} rated ${rating}`)
    return true
  }

  /**
   * Get user's products
   */
  getUserProducts(userId: string): MarketplaceProduct[] {
    const listings = this.userListings.get(userId) || []
    return listings
      .map((listing) =>
        Array.from(this.products.values()).find((p) => p.id === listing.productId)
      )
      .filter((p) => p !== undefined) as MarketplaceProduct[]
  }

  /**
   * Get user's purchase history
   */
  getUserPurchases(userId: string): PurchaseRecord[] {
    return Array.from(this.purchases.values()).filter((p) => p.userId === userId)
  }

  /**
   * Get marketplace statistics
   */
  getMarketplaceStats(): ListingStats {
    const products = Array.from(this.products.values())
    const purchases = Array.from(this.purchases.values()).filter((p) => p.status === 'completed')

    const totalDownloads = products.reduce((sum, p) => sum + p.downloads, 0)
    const totalRevenue = purchases.reduce((sum, p) => sum + p.amount, 0)
    const averageRating =
      products.length > 0
        ? products.reduce((sum, p) => sum + p.rating, 0) / products.length
        : 0

    const topProducts = products
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, 5)
      .map((p) => p.id)

    return {
      totalProducts: products.length,
      totalDownloads,
      totalRevenue,
      averageRating,
      topProducts
    }
  }

  /**
   * Update product listing
   */
  updateListing(productId: string, updates: Partial<MarketplaceProduct>): boolean {
    const product = this.products.get(productId)
    if (!product) return false

    Object.assign(product, { ...updates, id: product.id, updatedAt: new Date() })
    return true
  }

  /**
   * Delete product listing
   */
  deleteListing(productId: string): boolean {
    if (!this.products.has(productId)) return false

    this.products.delete(productId)
    console.log(`🗑️ Marketplace: Deleted listing ${productId}`)
    return true
  }

  /**
   * Get categories
   */
  getCategories(): string[] {
    const categories = new Set(Array.from(this.products.values()).map((p) => p.category))
    return Array.from(categories)
  }

  /**
   * Get products by category
   */
  getProductsByCategory(category: string): MarketplaceProduct[] {
    return Array.from(this.products.values()).filter((p) => p.category === category)
  }
}
