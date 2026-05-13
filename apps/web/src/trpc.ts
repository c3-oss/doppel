import { createTRPCReact } from '@trpc/react-query'

import type { AppRouter } from '@c3-oss/doppel-server'

/**
 * Typed React tRPC proxy for the Doppel server router.
 */
export const trpc = createTRPCReact<AppRouter>()
