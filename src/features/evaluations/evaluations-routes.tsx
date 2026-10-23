import { useParams } from 'react-router';
import { EvaluationsPage } from './evaluations';
import { ScoreSheetPage } from './score-sheet';

// Pantallas de Evaluaciones tal como las monta el router (un solo archivo diferido).

export function EvaluationsRoute() {
  return <EvaluationsPage />;
}

export function ScoreSheetRoute() {
  const { id = '' } = useParams();
  return <ScoreSheetPage key={id} id={id} />;
}
