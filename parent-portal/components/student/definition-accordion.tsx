'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

type Props = { html: string };

/** 完成版モック: ◆ 振替残数の定義（薄緑枠・左揃え本文） */
export function DefinitionAccordion({ html }: Props) {
  return (
    <Accordion type="single" collapsible className="mt-4 w-full shrink-0 px-1">
      <AccordionItem value="definition" className="border-0">
        <AccordionTrigger className="rounded-xl border border-teal-500/50 bg-emerald-50/90 px-4 py-3.5 text-center text-sm font-bold text-emerald-800 shadow-sm hover:bg-emerald-50 data-[state=open]:rounded-b-none data-[state=open]:border-b-0">
          振替残数の定義
        </AccordionTrigger>
        <AccordionContent className="rounded-b-xl border border-t-0 border-teal-500/50 bg-emerald-50/40 px-3 pb-3 pt-2">
          <div
            className="definition-html definition-html--final max-h-[min(38vh,15rem)] overflow-y-auto overscroll-contain text-left text-sm leading-relaxed text-slate-700 [-webkit-overflow-scrolling:touch]"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
