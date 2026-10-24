import { z } from 'zod';

// Sin compilar validadores con `new Function`: la CSP de producción no permite
// eval y zod lo intentaría (bloqueado, y reportado como violación).
z.config({ jitless: true });

export { z };
