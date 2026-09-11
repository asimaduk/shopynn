export const SET_INVOICE_PREFIX = 'SET_INVOICE_PREFIX';
export const SET_INVOICE_NEXT = 'SET_INVOICE_NEXT';
export const INCREMENT_INVOICE_NEXT = 'INCREMENT_INVOICE_NEXT';
export const SET_RECEIPT_COMPANY_NAME = 'SET_RECEIPT_COMPANY_NAME';
export const SET_CURRENCY = 'SET_CURRENCY';
export const SET_EXCHANGE_RATE = 'SET_EXCHANGE_RATE';
export const SET_THEME_MODE = 'SET_THEME_MODE';
export const SET_VALUATION_METHOD = 'SET_VALUATION_METHOD';
export const SET_COMPANY_DETAILS = 'SET_COMPANY_DETAILS';
export const SET_SUBSCRIPTION_ACTIVE = 'SET_SUBSCRIPTION_ACTIVE';
export const SET_SUBSCRIPTION_PLAN = 'SET_SUBSCRIPTION_PLAN';
export const SET_SUBSCRIPTION_FEATURES = 'SET_SUBSCRIPTION_FEATURES';
export const SET_PRINT_AGENT = 'SET_PRINT_AGENT';

export const setInvoicePrefix = (payload) => ({ type: SET_INVOICE_PREFIX, payload });
export const setInvoiceNext = (payload) => ({ type: SET_INVOICE_NEXT, payload });
export const incrementInvoiceNext = () => ({ type: INCREMENT_INVOICE_NEXT });
export const setReceiptCompanyName = (payload) => ({ type: SET_RECEIPT_COMPANY_NAME, payload });
export const setCurrency = (payload) => ({ type: SET_CURRENCY, payload });
export const setExchangeRate = (payload) => ({ type: SET_EXCHANGE_RATE, payload });
export const setThemeMode = (payload) => ({ type: SET_THEME_MODE, payload });
export const setValuationMethod = (payload) => ({ type: SET_VALUATION_METHOD, payload });
export const setCompanyDetails = (payload) => ({ type: SET_COMPANY_DETAILS, payload });
export const setSubscriptionActive = (payload) => ({ type: SET_SUBSCRIPTION_ACTIVE, payload });
export const setSubscriptionPlan = (payload) => ({ type: SET_SUBSCRIPTION_PLAN, payload });
export const setSubscriptionFeatures = (payload) => ({ type: SET_SUBSCRIPTION_FEATURES, payload });
/** @param {{ host?: string, port?: number|string }} payload */
export const setPrintAgent = (payload) => ({ type: SET_PRINT_AGENT, payload });
