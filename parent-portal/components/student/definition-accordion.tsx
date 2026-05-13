'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

type Props = { html: string };

export function DefinitionAccordion({ html }: Props) {
  return (
    <Accordion type="single" collapsible className="mt-4 w-full shrink-0">
      <AccordionItem value="definition" className="border-0">
        <AccordionTrigger>詳しい説明（タップで開く）</AccordionTrigger>
        <AccordionContent className="border-0 p-0">
          <div
            className="definition-html text-center max-h-[min(36vh,14rem)] overflow-y-auto overscroll-contain px-2 py-3 text-base leading-relaxed text-slate-700 [-webkit-overflow-scrolling:touch]"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
