import { typoAliases } from './resources'

export const normaliseBotText = (value: string) => {
  const normalised = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en')
    .replace(/[’‘`]/g, "'")
    .replace(/\bdon't\b/g, 'dont')
    .replace(/\bcan't\b/g, 'cant')
    .replace(/\bwon't\b/g, 'wont')
    .replace(/[^\p{L}\p{N}'-]+/gu, ' ')
    .replace(/[-']/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')

  return normalised
    .split(' ')
    .map((token) => typoAliases[token] ?? token)
    .join(' ')
}

export const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const includesPhrase = (normalised: string, phrase: string) => {
  const candidate = normaliseBotText(phrase)
  return new RegExp(`(?:^|\\s)${escapeRegExp(candidate).replace(/\\ /g, '\\s+')}(?:$|\\s)`).test(
    normalised,
  )
}

export const findPhrase = (normalised: string, phrases: string[]) =>
  phrases.find((phrase) => includesPhrase(normalised, phrase))

export const tokenise = (value: string) => normaliseBotText(value).split(' ').filter(Boolean)
