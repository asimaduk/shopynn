const CHAT_TOKEN_KEY = "shopynn_chat_visitor_token";

export function getStoredChatToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CHAT_TOKEN_KEY);
}

export function setStoredChatToken(token: string) {
  localStorage.setItem(CHAT_TOKEN_KEY, token);
}

export function clearStoredChatToken() {
  localStorage.removeItem(CHAT_TOKEN_KEY);
}
