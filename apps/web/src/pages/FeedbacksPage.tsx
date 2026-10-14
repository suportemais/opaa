import '../styles/painel-feedbacks.css';
import { FeedbacksTela } from '../components/painel/feedbacks/FeedbacksTela';

/** /app/feedbacks — lista (alternância "Lista | Kanban" no topo). */
export function FeedbacksPage() {
  return <FeedbacksTela visao="lista" />;
}
