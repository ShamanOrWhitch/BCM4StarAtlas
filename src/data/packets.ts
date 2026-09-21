export const PACKETS: Record<string, string> = {
  koben: "Jetjet-1",
  seraimal: "Jetjet-1",
  shimadair: "Jetjet-2",
  takedaani: "Jetjet-2",
  uusathar: "Jetjet-3",
  urtelaorilve: "Jetjet-3",
  viurneca: "Проба-1",
  yarrindilpho: "Проба-1",
  taakorinthilo: "Проба запас",
  ooniseth: "Jetjet Ooniseth",
  arsamehafa: "Jetjet Ooniseth",
  deceon: "Tufa (проект)",
  tavia: "Tufa (проект)",
  laraellipa: "Tufa запас",
  pricer: "Chi гараж",
  raurtawa: "CSS инж",
  phulelonva: "CSS инж",
  elizondo: "CSS камбуз",
  trovam: "CSS камбуз",
  anbeloon: "CSS госпиталь",
  aaveortearsi: "CSS ангар",
};

export function packetOf(id: string) {
  return PACKETS[id] ?? null;
}
