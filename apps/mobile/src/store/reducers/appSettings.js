import { SET_INVOICE_PREFIX, SET_INVOICE_NEXT, INCREMENT_INVOICE_NEXT, SET_RECEIPT_COMPANY_NAME, SET_CURRENCY, SET_EXCHANGE_RATE, SET_THEME_MODE, SET_VALUATION_METHOD, SET_COMPANY_DETAILS, SET_SUBSCRIPTION_ACTIVE, SET_SUBSCRIPTION_PLAN, SET_SUBSCRIPTION_FEATURES } from '../actions/appSettings';

const CURRENCY_SYMBOLS = { GHS: 'GH₵', USD: '$', EUR: '€', GBP: '£' };
const initialState = {
    invoicePrefix: 'INV', invoiceNextNumber: 1001, receiptCompanyName: 'Shopynn',
    currency: 'GHS', currencySymbol: 'GH₵', exchangeRateToGHS: 1,
    themeMode: 'system', // 'light', 'dark', or 'system'
    valuationMethod: 'fifo', // 'fifo' | 'lifo' | 'weighted_average' - for COGS and stock value
    companyDetailsSet: false,
    companyName: '', companyAddress: '', companyPhone: '', companyEmail: '', companyIndustry: '',
    subscriptionActive: true, // set false after login when API says subscription inactive
    subscriptionPlan: null, // { name, id?, amount?, billingInterval?, endAt?, status? } from subscriptions/current
    subscriptionFeatures: [],
};

export default function appSettings(state = initialState, action) {
    switch (action.type) {
        case SET_INVOICE_PREFIX: return { ...state, invoicePrefix: action.payload };
        case SET_INVOICE_NEXT: return { ...state, invoiceNextNumber: Number(action.payload) || state.invoiceNextNumber };
        case INCREMENT_INVOICE_NEXT: return { ...state, invoiceNextNumber: (state.invoiceNextNumber || 1001) + 1 };
        case SET_RECEIPT_COMPANY_NAME: return { ...state, receiptCompanyName: action.payload };
        case SET_CURRENCY: return { ...state, currency: action.payload, currencySymbol: CURRENCY_SYMBOLS[action.payload] || 'GH₵' };
        case SET_EXCHANGE_RATE: return { ...state, exchangeRateToGHS: Number(action.payload) || 1 };
        case SET_THEME_MODE: return { ...state, themeMode: action.payload };
        case SET_VALUATION_METHOD: return { ...state, valuationMethod: action.payload };
        case SET_COMPANY_DETAILS: return {
            ...state,
            companyDetailsSet: true,
            companyName: action.payload.companyName ?? state.companyName,
            companyAddress: action.payload.companyAddress ?? state.companyAddress,
            companyPhone: action.payload.companyPhone ?? state.companyPhone,
            companyEmail: action.payload.companyEmail ?? state.companyEmail,
            companyIndustry: action.payload.companyIndustry ?? state.companyIndustry,
            receiptCompanyName: action.payload.companyName ?? state.receiptCompanyName,
        };
        case SET_SUBSCRIPTION_ACTIVE: return { ...state, subscriptionActive: !!action.payload };
        case SET_SUBSCRIPTION_PLAN: return { ...state, subscriptionPlan: action.payload == null ? null : { ...action.payload } };
        case SET_SUBSCRIPTION_FEATURES:
            return {
                ...state,
                subscriptionFeatures: Array.isArray(action.payload)
                    ? action.payload.map((f) => String(f).trim().toLowerCase()).filter(Boolean)
                    : [],
            };
        default: return state;
    }
}
