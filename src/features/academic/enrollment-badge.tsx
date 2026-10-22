import type { EnrollmentStatus } from '@/api/types';
import { Badge } from '@/components/ui/badge';
import { STATUS_LABELS, STATUS_VARIANTS } from './enrollment-rules';

export function EnrollmentBadge({ status }: { status: EnrollmentStatus }) {
  return (
    <Badge variant={STATUS_VARIANTS[status]} className="whitespace-nowrap">
      {STATUS_LABELS[status]}
    </Badge>
  );
}
