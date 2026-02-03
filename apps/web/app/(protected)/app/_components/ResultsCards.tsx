import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";
import { PriceSummaryCombined } from "@/components/PriceSummaryCombined";

import type { FrontendPayload } from "../types";

type ResultsCardsProps = {
  data: FrontendPayload;
};

export function ResultsCards({ data }: ResultsCardsProps) {
  const ma = data.market_analysis;

  return (
    <div className="space-y-4">
      <Card
        title="Query"
        right={
          <div className="flex items-center gap-2">
            {data.timing_sec != null ? <Badge>{data.timing_sec}s</Badge> : null}
          </div>
        }
      >
        <div className="text-sm text-slate-700 dark:text-slate-400 space-y-1">
          <div>
            <span className="font-medium text-slate-900 dark:text-slate-200">Initial:</span>{" "}
            <span className="font-mono text-[13px]">{data.initial_query}</span>
          </div>
          <div>
            <span className="font-medium text-slate-900 dark:text-slate-200">Refined:</span>{" "}
            {data.refined_query ? (
              <span className="font-mono text-[13px]">{data.refined_query}</span>
            ) : (
              <span className="text-slate-500">-</span>
            )}
          </div>
          <div className="pt-2 flex flex-wrap gap-2">
            <Badge>Velocity: {ma.sell_velocity}</Badge>
            <Badge>Rarity: {ma.rarity}</Badge>
            <Badge>
              Matches: active {ma.active.similar_count} · sold {ma.sold.similar_count}
            </Badge>
          </div>
        </div>
      </Card>

      <Card title="Pricing Summary">
        <PriceSummaryCombined activeRange={ma.active.price_range} soldRange={ma.sold.price_range} />
      </Card>

      <Card title="Legit check (starter)">
        {data.legit_check_advice?.length ? (
          <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700 dark:text-slate-400">
            {data.legit_check_advice.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-slate-600">No advice available.</div>
        )}
      </Card>

      <Card title="Summary">
        <div className="text-sm text-slate-700 dark:text-slate-400 leading-relaxed">
          {data.summary || "-"}
        </div>
      </Card>
    </div>
  );
}
