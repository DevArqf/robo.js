import type { HttpMethodExport, ApiHandlerModule } from '../robo/routes/api.js'

/**
 * Options for creating a test request
 */
export interface TestRequestOptions {
	/** HTTP method (defaults to 'GET') */
	method?: HttpMethodExport
	/** URL path (defaults to '/test') */
	path?: string
	/** URL parameters extracted from dynamic segments like [id] */
	params?: Record<string, string>
	/** Query string parameters */
	query?: Record<string, string | string[]>
	/** Request headers */
	headers?: Record<string, string>
	/** Request body (will be JSON stringified if object) */
	body?: unknown
	/** Base URL for constructing absolute URLs (defaults to 'http://localhost:3000') */
	baseUrl?: string
}

/**
 * Options for testing a route module
 */
export interface TestRouteOptions extends TestRequestOptions {
	/** Override method detection and call a specific handler */
	forceHandler?: HttpMethodExport | 'default'
}

/**
 * Result type for route testing that includes both Response and convenience methods
 */
export interface TestRouteResult {
	/** The raw Response object */
	response: Response
	/** Response status code */
	status: number
	/** Whether response status is 2xx */
	ok: boolean
	/** Parse response body as JSON */
	json<T = unknown>(): Promise<T>
	/** Get response body as text */
	text(): Promise<string>
	/** Get a response header value */
	header(name: string): string | null
}

/**
 * Handler module that can be tested
 */
export type TestableModule = ApiHandlerModule

/**
 * Test client route configuration
 */
export interface TestClientRoute {
	pattern: string
	module: TestableModule
}

/**
 * Test client instance for testing multiple routes
 */
export interface TestClient {
	/** Register a route module */
	route(pattern: string, module: TestableModule): TestClient
	/** Execute a GET request */
	get(path: string, options?: Omit<TestRequestOptions, 'method'>): Promise<TestRouteResult>
	/** Execute a POST request */
	post(path: string, options?: Omit<TestRequestOptions, 'method'>): Promise<TestRouteResult>
	/** Execute a PUT request */
	put(path: string, options?: Omit<TestRequestOptions, 'method'>): Promise<TestRouteResult>
	/** Execute a DELETE request */
	delete(path: string, options?: Omit<TestRequestOptions, 'method'>): Promise<TestRouteResult>
	/** Execute a PATCH request */
	patch(path: string, options?: Omit<TestRequestOptions, 'method'>): Promise<TestRouteResult>
	/** Execute an OPTIONS request */
	options(path: string, options?: Omit<TestRequestOptions, 'method'>): Promise<TestRouteResult>
	/** Execute a HEAD request */
	head(path: string, options?: Omit<TestRequestOptions, 'method'>): Promise<TestRouteResult>
	/** Execute a request with any method */
	request(method: HttpMethodExport, path: string, options?: Omit<TestRequestOptions, 'method'>): Promise<TestRouteResult>
}
