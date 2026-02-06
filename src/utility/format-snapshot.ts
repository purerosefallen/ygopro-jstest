import { OcgcoreScriptConstants, CardData } from 'ygopro-msg-encode';
import { CardHandle } from '../card-handle';

export type YGOProSnapshot = {
  cards: (Partial<CardHandle> & { name: string | null })[];
  lp: number[];
  chains: Array<{
    code: number;
    chainCardController: number;
    chainCardLocation: number;
    chainCardSequence: number;
  }>;
};

export function formatSnapshot(
  snapshot: YGOProSnapshot,
  readCard?: (code: number) => (Partial<CardData> & { name?: string }) | null,
) {
  const formatCardName = (
    card: (typeof snapshot.cards)[number],
    showHash: boolean,
  ) => {
    const name = card.name ?? (card.code ? `#${card.code}` : 'Unknown');
    if (!showHash) {
      return name;
    }
    return `#${card.sequence} ${name}`;
  };

  const byPlayer = (player: number) =>
    snapshot.cards.filter((card) => card.controller === player);

  const byLocation = (
    cards: (typeof snapshot.cards)[number][],
    loc: number,
    showHash: boolean,
  ) =>
    cards
      .filter((card) => card.location === loc)
      .sort((a, b) => a.sequence - b.sequence)
      .map((card) => formatCardName(card, showHash));

  const zoneLabels = ['Hand', 'Spell', 'Monster', 'Grave', 'Removed'];
  const labelWidth = Math.max(...zoneLabels.map((label) => label.length));
  const labelPad = ' '.repeat(labelWidth);
  const linePad = ' '.repeat(labelWidth + 2);

  const formatZoneLines = (label: string, cards: string[]) => {
    if (!cards.length) {
      return [];
    }
    const paddedLabel = label.padStart(labelWidth);
    return cards.map((card, index) => {
      if (index === 0) {
        return `${paddedLabel}: ${card}`;
      }
      return `${linePad}${card}`;
    });
  };

  const formatPlayer = (player: number) => {
    const cards = byPlayer(player);
    const mzone = byLocation(
      cards,
      OcgcoreScriptConstants.LOCATION_MZONE,
      true,
    );
    const szone = byLocation(
      cards,
      OcgcoreScriptConstants.LOCATION_SZONE,
      true,
    );
    const hand = byLocation(cards, OcgcoreScriptConstants.LOCATION_HAND, false);
    const grave = byLocation(
      cards,
      OcgcoreScriptConstants.LOCATION_GRAVE,
      false,
    );
    const removed = byLocation(
      cards,
      OcgcoreScriptConstants.LOCATION_REMOVED,
      false,
    );
    return [
      `********* Player ${player} *********`,
      ...formatZoneLines('Hand', hand),
      ...formatZoneLines('Spell', szone),
      ...formatZoneLines('Monster', mzone),
      ...formatZoneLines('Grave', grave),
      ...formatZoneLines('Removed', removed),
    ];
  };

  const chainInfo = snapshot.chains.length
    ? snapshot.chains
        .map((chain, index) => {
          const cardInfo = readCard ? readCard(chain.code) : null;
          const name = cardInfo?.name ?? `#${chain.code}`;
          return `${index + 1}:${name}@${chain.chainCardController}/${chain.chainCardLocation}/${chain.chainCardSequence}`;
        })
        .join(', ')
    : null;

  const lines = [
    '********* Field Snapshot *********',
    `LP: P0 ${snapshot.lp[0]} | P1 ${snapshot.lp[1]}`,
  ];
  if (chainInfo) {
    lines.push(`Chain: ${chainInfo}`);
  }
  lines.push(
    ...formatPlayer(0),
    ...formatPlayer(1),
    '********* Finish *********',
  );
  return lines.join('\n');
}
