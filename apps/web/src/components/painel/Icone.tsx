// Ícones do painel: símbolos de public/painel/icones.svg (vindos do protótipo).
export type NomeIcone =
  | 'dashboard' | 'ranking' | 'ocorrencias' | 'denuncias' | 'pesquisas' | 'clientes' | 'premios' | 'config'
  | 'sair' | 'menu' | 'fechar' | 'lista' | 'relogio' | 'pessoa' | 'loja' | 'busca' | 'seta' | 'alerta' | 'ia'
  | 'mais' | 'cadeado' | 'lixeira' | 'cima' | 'baixo' | 'link' | 'arquivar' | 'editar' | 'texto' | 'nota10'
  | 'polegar' | 'estrela' | 'estrela-cheia' | 'lua' | 'sol' | 'ok' | 'escolha' | 'celular' | 'plug' | 'feedbacks' | 'qr';

export function Icone({ nome, className }: { nome: NomeIcone; className?: string }) {
  return (
    <svg className={className ? `icone ${className}` : 'icone'} aria-hidden="true">
      <use href={`/painel/icones.svg#${nome}`} />
    </svg>
  );
}
