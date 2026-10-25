export function createWeeklyHostedHandler(o: {secret: string | undefined; ejecutar: (o: {deadlineAt: number}) => Promise<unknown>; timeoutMs?: number}): (request: Request) => Promise<Response>;
