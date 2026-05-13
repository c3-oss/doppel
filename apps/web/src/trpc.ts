import { createTRPCReact } from '@trpc/react-query';

import type { AppRouter } from '@c3-oss/doppel-server';

export const trpc = createTRPCReact<AppRouter>();
