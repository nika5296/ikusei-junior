'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

type Props = { html: string };

function DiamondGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 1.2 14.8 8 8 14.8 1.2 8 8 1.2z" />
    </svg>
  );
}

/** 薄ミントの説明カード（左：ひし形・見出し「振替残数の定義」） */
export function DefinitionAccordion({ html }: Props) {
  return (
    <Accordion type="single" collapsible className="mt-5 w-full shrink-0 px-1">
      <AccordionItem value="definition" className="border-0">
        <AccordionTrigger className="rounded-2xl border border-emerald-200/60 bg-[#EAFBF3] px-4 py-4 text-[#14532d] shadow-sm hover:bg-[#dff8eb] data-[state=open]:rounded-b-none data-[state=open]:border-b-0">
          <DiamondGlyph className="size-4 shrink-0 text-[#009b6b]" />
          <span className="font-bold tracking-tight">振替残数の定義</span>
        </AccordionTrigger>
        <AccordionContent className="rounded-b-2xl border border-t-0 border-emerald-200/60 bg-[#EAFBF3] px-3 pb-3 pt-2">
          <div
            className="definition-html definition-html--final max-h-[min(38vh,15rem)] overflow-y-auto overscroll-contain text-left text-[15px] leading-relaxed text-[#1F2937] [-webkit-overflow-scrolling:touch]"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
