import { CHARGILY_LIVE_URL, CHARGILY_TEST_URL } from '../consts';
import { ChargilyApiError, ChargilyNetworkError } from '../errors';
import { ChargilyLogger, noopLogger } from '../logger';
import { RateLimiter } from '../rate-limiter';
import {
  Balance,
  Checkout,
  CheckoutItem,
  Customer,
  PaymentLink,
  PaymentLinkItem,
  Price,
  Product,
  ProductPrice,
} from '../types/data';
import {
  CreateCheckoutParams,
  CreateCustomerParams,
  CreatePaymentLinkParams,
  CreatePriceParams,
  CreateProductParams,
  PaginationParams,
  UpdateCustomerParams,
  UpdatePaymentLinkParams,
  UpdatePriceParams,
  UpdateProductParams,
} from '../types/param';
import { DeleteItemResponse, ListResponse } from '../types/response';

/**
 * Configuration options for ChargilyClient.
 */
export interface ChargilyClientOptions {
  /** The API key for authentication with Chargily API. */
  api_key: string;

  /** Operating mode: 'test' or 'live'. */
  mode: 'test' | 'live';

  /** Request timeout in milliseconds (default: 30000). */
  timeout?: number;

  /** Maximum number of retries on 429/5xx errors (default: 2). */
  maxRetries?: number;

  /** Base delay in ms for exponential backoff (default: 1000). */
  retryDelay?: number;

  /** Optional logger for debugging SDK requests. */
  logger?: ChargilyLogger;

  /** Maximum requests per second (default: 5). Set to 0 to disable rate limiting. */
  maxRequestsPerSecond?: number;
}

export interface RequestOptions {
  /** Idempotency key to prevent duplicate operations. */
  idempotencyKey?: string;
}

/**
 * A client for interacting with Chargily's API, supporting operations for customers, products, prices, checkouts, and payment links.
 */
export class ChargilyClient {
  private api_key: string;
  private base_url: string;
  private timeout: number;
  private maxRetries: number;
  private retryDelay: number;
  private logger: ChargilyLogger;
  private rateLimiter: RateLimiter | null;

  constructor(options: ChargilyClientOptions) {
    if (!options.api_key) {
      throw new Error('api_key is required');
    }
    if (options.mode !== 'test' && options.mode !== 'live') {
      throw new Error("mode must be 'test' or 'live'");
    }
    this.api_key = options.api_key;
    this.base_url = options.mode === 'test' ? CHARGILY_TEST_URL : CHARGILY_LIVE_URL;
    this.timeout = options.timeout ?? 30000;
    this.maxRetries = options.maxRetries ?? 2;
    this.retryDelay = options.retryDelay ?? 1000;
    this.logger = options.logger ?? noopLogger;
    const rps = options.maxRequestsPerSecond ?? 5;
    this.rateLimiter = rps > 0 ? new RateLimiter(rps) : null;
  }

  /**
   * Builds a paginated query string from PaginationParams.
   */
  private buildPaginationQuery(options?: PaginationParams): string {
    const per_page = Math.min(Math.max(options?.per_page ?? 10, 1), 50);
    const page = Math.max(options?.page ?? 1, 1);
    return `per_page=${per_page}&page=${page}`;
  }

  private async request(
    endpoint: string,
    method: string = 'GET',
    body?: any,
    options?: RequestOptions
  ): Promise<any> {
    const url = `${this.base_url}/${endpoint}`;
    let lastError: Error | null = null;

    this.logger.debug(`${method} ${endpoint}`, { body: body ? '(body)' : undefined });

    if (this.rateLimiter) {
      await this.rateLimiter.acquire();
    }

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        this.logger.warn(`Retry attempt ${attempt}/${this.maxRetries} after ${delay}ms`, {
          endpoint,
          method,
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.api_key}`,
        'Content-Type': 'application/json',
      };

      if (options?.idempotencyKey) {
        headers['Idempotency-Key'] = options.idempotencyKey;
      }

      const fetchOptions: RequestInit = {
        method,
        headers,
        signal: controller.signal,
      };

      if (body !== undefined) {
        fetchOptions.body = JSON.stringify(body);
      }

      try {
        const response = await fetch(url, fetchOptions);
        clearTimeout(timeoutId);

        if (!response.ok) {
          const retryable = response.status === 429 || response.status >= 500;

          if (retryable && attempt < this.maxRetries) {
            lastError = new Error(`HTTP ${response.status}`);
            continue;
          }

          const errorBody = await response.json().catch(() => null);
          this.logger.error(`API error ${response.status} on ${method} ${endpoint}`, {
            status: response.status,
            body: errorBody,
          });
          throw new ChargilyApiError(response.status, response.statusText, errorBody);
        }

        return response.json();
      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof ChargilyApiError) {
          throw error;
        }

        if (attempt < this.maxRetries) {
          lastError = error instanceof Error ? error : new Error(String(error));
          continue;
        }

        throw new ChargilyNetworkError(
          error instanceof Error ? error.message : String(error),
          error instanceof Error ? error : undefined
        );
      }
    }

    throw new ChargilyNetworkError(
      lastError?.message ?? 'Max retries exceeded',
      lastError instanceof Error ? lastError : undefined
    );
  }

  /**
   * Retrieves the current balance information from the Chargily API.
   * @returns {Promise<Balance>} - A promise that resolves to the balance information.
   */
  public async getBalance(): Promise<Balance> {
    return this.request('balance', 'GET');
  }

  /**
   * Creates a new customer with specified details.
   * @param {CreateCustomerParams} customer_data - The data for creating a new customer.
   * @returns {Promise<Customer>} - A promise that resolves to the newly created customer.
   */
  public async createCustomer(
    customer_data: CreateCustomerParams,
    options?: RequestOptions
  ): Promise<Customer> {
    return this.request('customers', 'POST', customer_data, options);
  }

  /**
   * Fetches a customer by their unique identifier.
   * @param {string} customer_id - The ID of the customer to retrieve.
   * @returns {Promise<Customer>} - A promise that resolves to the customer details.
   */
  public async getCustomer(customer_id: string): Promise<Customer> {
    return this.request(`customers/${customer_id}`, 'GET');
  }

  /**
   * Updates an existing customer's details.
   * @param {string} customer_id - The ID of the customer to update.
   * @param {UpdateCustomerParams} update_data - New data for updating the customer.
   * @returns {Promise<Customer>} - A promise that resolves to the updated customer details.
   */
  public async updateCustomer(
    customer_id: string,
    update_data: UpdateCustomerParams,
    options?: RequestOptions
  ): Promise<Customer> {
    return this.request(`customers/${customer_id}`, 'PATCH', update_data, options);
  }

  /**
   * Deletes a customer by their unique identifier.
   * @param {string} customer_id - The ID of the customer to delete.
   * @returns {Promise<DeleteItemResponse>} - A promise that resolves to the deletion response.
   */
  public async deleteCustomer(
    customer_id: string,
    options?: RequestOptions
  ): Promise<DeleteItemResponse> {
    return this.request(`customers/${customer_id}`, 'DELETE', undefined, options);
  }

  /**
   * Lists customers, optionally paginated.
   * @param {number} [per_page=10] - The number of customers to return per page.
   * @returns {Promise<ListResponse<Customer>>} - A promise that resolves to a paginated list of customers.
   */
  public async listCustomers(options?: PaginationParams): Promise<ListResponse<Customer>> {
    return this.request(`customers?${this.buildPaginationQuery(options)}`, 'GET');
  }

  /**
   * Creates a new product with the given details.
   * @param {CreateProductParams} product_data - The data for creating the product.
   * @returns {Promise<Product>} The created product.
   */
  public async createProduct(
    product_data: CreateProductParams,
    options?: RequestOptions
  ): Promise<Product> {
    return this.request('products', 'POST', product_data, options);
  }

  /**
   * Updates an existing product identified by its ID.
   * @param {string} product_id - The ID of the product to update.
   * @param {UpdateProductParams} update_data - The data to update the product with.
   * @returns {Promise<Product>} The updated product.
   */
  public async updateProduct(
    product_id: string,
    update_data: UpdateProductParams,
    options?: RequestOptions
  ): Promise<Product> {
    return this.request(`products/${product_id}`, 'PATCH', update_data, options);
  }

  /**
   * Retrieves a single product by its ID.
   * @param {string} product_id - The ID of the product to retrieve.
   * @returns {Promise<Product>} The requested product.
   */
  public async getProduct(product_id: string): Promise<Product> {
    return this.request(`products/${product_id}`, 'GET');
  }

  /**
   * Lists all products with optional pagination.
   * @param {number} [per_page=10] - The number of products to return per page.
   * @returns {Promise<ListResponse<Product>>} A paginated list of products.
   */
  public async listProducts(options?: PaginationParams): Promise<ListResponse<Product>> {
    return this.request(`products?${this.buildPaginationQuery(options)}`, 'GET');
  }

  /**
   * Deletes a product by its ID.
   * @param {string} product_id - The ID of the product to delete.
   * @returns {Promise<DeleteItemResponse>} Confirmation of the product deletion.
   */
  public async deleteProduct(
    product_id: string,
    options?: RequestOptions
  ): Promise<DeleteItemResponse> {
    return this.request(`products/${product_id}`, 'DELETE', undefined, options);
  }

  /**
   * Retrieves all prices associated with a product, with optional pagination.
   * @param {string} product_id - The ID of the product whose prices are to be retrieved.
   * @param {number} [per_page=10] - The number of prices to return per page.
   * @returns {Promise<ListResponse<ProductPrice>>} A paginated list of prices for the specified product.
   */
  public async getProductPrices(
    product_id: string,
    options?: PaginationParams
  ): Promise<ListResponse<ProductPrice>> {
    return this.request(
      `products/${product_id}/prices?${this.buildPaginationQuery(options)}`,
      'GET'
    );
  }

  /**
   * Creates a new price for a product.
   * @param {CreatePriceParams} price_data - The details of the new price to be created.
   * @returns {Promise<Price>} The created price object.
   */
  public async createPrice(
    price_data: CreatePriceParams,
    options?: RequestOptions
  ): Promise<Price> {
    return this.request('prices', 'POST', price_data, options);
  }

  /**
   * Updates the details of an existing price.
   * @param {string} price_id - The ID of the price to be updated.
   * @param {UpdatePriceParams} update_data - The new details for the price.
   * @returns {Promise<Price>} The updated price object.
   */
  public async updatePrice(
    price_id: string,
    update_data: UpdatePriceParams,
    options?: RequestOptions
  ): Promise<Price> {
    return this.request(`prices/${price_id}`, 'PATCH', update_data, options);
  }

  /**
   * Retrieves a single price by its ID.
   * @param {string} price_id - The ID of the price to retrieve.
   * @returns {Promise<Price>} The requested price object.
   */
  public async getPrice(price_id: string): Promise<Price> {
    return this.request(`prices/${price_id}`, 'GET');
  }

  /**
   * Lists all prices for products with optional pagination.
   * @param {number} [per_page=10] - The number of price objects to return per page.
   * @returns {Promise<ListResponse<Price>>} A paginated list of prices.
   */
  public async listPrices(options?: PaginationParams): Promise<ListResponse<Price>> {
    return this.request(`prices?${this.buildPaginationQuery(options)}`, 'GET');
  }

  /**
   * Creates a new checkout session with the specified details.
   * @param {CreateCheckoutParams} checkout_data - The details for the new checkout session.
   * @returns {Promise<Checkout>} The created checkout object.
   */
  public async createCheckout(
    checkout_data: CreateCheckoutParams,
    options?: RequestOptions
  ): Promise<Checkout> {
    const validateUrl = (url: string, field: string): void => {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          throw new Error();
        }
      } catch {
        throw new Error(`Invalid ${field}: must be a valid URL starting with http:// or https://`);
      }
    };

    validateUrl(checkout_data.success_url, 'success_url');

    if (checkout_data.failure_url) {
      validateUrl(checkout_data.failure_url, 'failure_url');
    }

    if (checkout_data.webhook_endpoint) {
      validateUrl(checkout_data.webhook_endpoint, 'webhook_endpoint');
    }

    if (!checkout_data.items && (!checkout_data.amount || !checkout_data.currency)) {
      throw new Error('The items field is required when amount and currency are not present.');
    }

    return this.request('checkouts', 'POST', checkout_data, options);
  }

  /**
   * Retrieves details of a specific checkout session by its ID.
   * @param {string} checkout_id - The ID of the checkout session to retrieve.
   * @returns {Promise<Checkout>} The requested checkout object.
   */
  public async getCheckout(checkout_id: string): Promise<Checkout> {
    return this.request(`checkouts/${checkout_id}`, 'GET');
  }

  /**
   * Lists all checkout sessions with optional pagination.
   * @param {number} [per_page=10] - The number of checkout objects to return per page.
   * @returns {Promise<ListResponse<Checkout>>} A paginated list of checkout sessions.
   */
  public async listCheckouts(options?: PaginationParams): Promise<ListResponse<Checkout>> {
    return this.request(`checkouts?${this.buildPaginationQuery(options)}`, 'GET');
  }

  /**
   * Retrieves all items included in a specific checkout session, with optional pagination.
   * @param {string} checkout_id - The ID of the checkout session.
   * @param {number} [per_page=10] - The number of items to return per page.
   * @returns {Promise<ListResponse<CheckoutItem>>} A paginated list of items in the checkout session.
   */
  public async getCheckoutItems(
    checkout_id: string,
    options?: PaginationParams
  ): Promise<ListResponse<CheckoutItem>> {
    return this.request(
      `checkouts/${checkout_id}/items?${this.buildPaginationQuery(options)}`,
      'GET'
    );
  }

  /**
   * Expires a specific checkout session before its automatic expiration.
   * @param {string} checkout_id - The ID of the checkout session to expire.
   * @returns {Promise<Checkout>} The expired checkout object, indicating the session is no longer valid for payment.
   */
  public async expireCheckout(checkout_id: string, options?: RequestOptions): Promise<Checkout> {
    return this.request(`checkouts/${checkout_id}/expire`, 'POST', undefined, options);
  }

  /**
   * Creates a new payment link.
   * @param {CreatePaymentLinkParams} payment_link_data - The details for the new payment link.
   * @returns {Promise<PaymentLink>} The created payment link object.
   */
  public async createPaymentLink(
    payment_link_data: CreatePaymentLinkParams,
    options?: RequestOptions
  ): Promise<PaymentLink> {
    return this.request('payment-links', 'POST', payment_link_data, options);
  }

  /**
   * Updates an existing payment link identified by its ID.
   * @param {string} payment_link_id - The ID of the payment link to update.
   * @param {UpdatePaymentLinkParams} update_data - The new details for the payment link.
   * @returns {Promise<PaymentLink>} The updated payment link object.
   */
  public async updatePaymentLink(
    payment_link_id: string,
    update_data: UpdatePaymentLinkParams,
    options?: RequestOptions
  ): Promise<PaymentLink> {
    return this.request(`payment-links/${payment_link_id}`, 'PATCH', update_data, options);
  }

  /**
   * Retrieves details of a specific payment link by its ID.
   * @param {string} payment_link_id - The ID of the payment link to retrieve.
   * @returns {Promise<PaymentLink>} The requested payment link object.
   */
  public async getPaymentLink(payment_link_id: string): Promise<PaymentLink> {
    return this.request(`payment-links/${payment_link_id}`, 'GET');
  }

  /**
   * Lists all payment links with optional pagination.
   * @param {number} [per_page=10] - The number of payment link objects to return per page.
   * @returns {Promise<ListResponse<PaymentLink>>} A paginated list of payment links.
   */
  public async listPaymentLinks(options?: PaginationParams): Promise<ListResponse<PaymentLink>> {
    return this.request(`payment-links?${this.buildPaginationQuery(options)}`, 'GET');
  }

  /**
   * Retrieves all items associated with a specific payment link, with optional pagination.
   * @param {string} payment_link_id - The ID of the payment link whose items are to be retrieved.
   * @param {number} [per_page=10] - The number of items to return per page.
   * @returns {Promise<ListResponse<PaymentLinkItem>>} A paginated list of items associated with the payment link.
   */
  public async getPaymentLinkItems(
    payment_link_id: string,
    options?: PaginationParams
  ): Promise<ListResponse<PaymentLinkItem>> {
    return this.request(
      `payment-links/${payment_link_id}/items?${this.buildPaginationQuery(options)}`,
      'GET'
    );
  }
}
