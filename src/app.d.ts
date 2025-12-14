// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: any
		}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env?: {
				AI: string
				// TRANSFER is a cloudflare R2 bucket
				TRANSFER: any
				// TRANSFER_KV is a Cloudflare KV namespace for file metadata
				TRANSFER_KV: KVNamespace
			}
		}
	}
}

export {};
