export const API="/private/api";
export const SENTENCE_API = API + "/sent";
export const FREE_PAGE_LIMIT = 10;
export const strEqIgnCase = (a: string | null | undefined, b: string | null | undefined): boolean =>
    !!a && !!b && a.toLowerCase() === b.toLowerCase();

export const IMAGE_CDN_PREFIX = "https://images.mywords.io/"

export const CHAR_PER_PAGE = 1466;

export const sanitize = (text: string) =>
    text? text.replace(/\s+/g, ' ').trim(): '';

export const COLLECTION_KEY = "collections:page"

export const PRIVATE_URL = "/private";
export const WORDS_URL = PRIVATE_URL + "/words";
export const COLLECTIONS_URL = "/private/collections";

export enum UserActionEnum {
    VIEW = "VIEW",
    PURCHASE = "PURCHASE"
}

export const WORDS_PER_PAGE = 50;

export const SENTENCES_PER_TABLE = 10;

export const BLOGS_PER_PAGE = 3;

export const ERROR ='Error';

export enum contextStatusEnum {
    INIT = 0,
    PUBLISHED = 1,
    DELETED = 2,
}

export const ORIGIN = import.meta.env.VITE_ORIGIN;

import {z} from "zod";

export enum ENVS {
    PROD = 'prod',
    DEV = 'dev',
    LOCAL = 'local'
}

export const tokenSchema = z.string()
    .transform(str => z.object({access_token: z.string()}).passthrough().parse(JSON.parse(str)));

export const FE_TOKEN = "myWordsSession";