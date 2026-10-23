import { Badge } from '@/components/ui/badge';

/** Vigente o desactualizado (sus notas cambiaron después de generarlo), con texto. */
export function ReportCardStatus({ outdated }: { outdated: boolean }) {
  return outdated ? (
    <Badge variant="caution" className="whitespace-nowrap">
      Desactualizado
    </Badge>
  ) : (
    <Badge variant="active" className="whitespace-nowrap">
      Vigente
    </Badge>
  );
}
