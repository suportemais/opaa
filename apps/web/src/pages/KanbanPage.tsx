import '../styles/painel-feedbacks.css';
import { FeedbacksTela } from '../components/painel/feedbacks/FeedbacksTela';

/** /app/feedbacks/kanban — mesma tela de Feedbacks, na visão Kanban. */
export function KanbanPage() {
  return <FeedbacksTela visao="kanban" />;
}
