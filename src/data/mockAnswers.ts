import type { Citation } from "@/types";

/**
 * Canned answers for MOCK MODE ONLY. They let the chat UI be demonstrated without a backend.
 * The mock adapter tags every answer with origin "mock" and the UI labels it as a demo answer.
 * These must never be used when the Amplifi proxy is connected.
 */
export interface MockAnswer {
  match: RegExp;
  text: string;
  citations: Citation[];
}

export const MOCK_ANSWERS: MockAnswer[] = [
  {
    match: /cp02|graphite\/hard carbon|−20|-20/i,
    text: "In 11.5 Ah NCM523 pouch cells, the graphite anode with a 15% hard carbon network ran 2,250 cycles at −20 °C and 4C with 88% capacity retention, and stayed stable at 8C and −40 °C [CP02]. This is a lithium-ion result.",
    citations: [{ paperId: "CP02", page: "1" }],
  },
  {
    match: /s-hc-2|cp09/i,
    text: "S-HC-2 is made from starch, with citric acid as a crosslinker [CP09].",
    citations: [{ paperId: "CP09", page: "2" }],
  },
  {
    match: /gcl8|cp07/i,
    text: "The GCL8 and NVP full cell delivers 298 mAh/g at 0.1C (based on the anode mass) with a first-cycle efficiency of 93.19%, and keeps 80% of its capacity after 100 cycles at 1C [CP07].",
    citations: [{ paperId: "CP07", page: "6, 8" }],
  },
  {
    match: /vgf|tranche/i,
    text: "The tranche II guidelines provide VGF of Rs 18 lakh per MWh for 30 GWh of battery storage, with projects commissioned within 18 months of signing the agreement [I2].",
    citations: [{ paperId: "I2", page: null }],
  },
];

export const MOCK_FALLBACK_ANSWER =
  "Demo mode can only answer the example questions. When the Amplifi proxy is connected, this question goes to Amplifi, which answers from the papers and cites them.";
