import OpenAI from "openai";

let _instance: OpenAI | null = null;

/** Retorna el cliente OpenAI. Se crea solo cuando se llama por primera vez (lazy). */
export function getOpenAI(): OpenAI {
  if (!_instance) {
    _instance = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  }
  return _instance;
}