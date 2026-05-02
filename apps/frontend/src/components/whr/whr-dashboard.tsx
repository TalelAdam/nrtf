"use client";

import { WhrKpiStrip } from './whr-kpi-strip';
import { WhrParamsSidebar } from './whr-params-sidebar';
import { WhrScenarioCards } from './whr-scenario-cards';
import { WhrEnergyChart } from './whr-energy-chart';
import { WhrSankey } from './whr-sankey';
import { WhrScoringTable } from './whr-scoring-table';
import { WhrEquationsPanel } from './whr-equations-panel';
import { WhrRoiChart } from './whr-roi-chart';

export function WhrDashboard() {
  return (
    <div className="whr-layout">
      <WhrParamsSidebar />
      <div className="whr-main">
        <WhrKpiStrip />

        <div className="whr-charts-row">
          <div className="whr-chart-cell">
            <WhrEnergyChart />
          </div>
          <div className="whr-chart-cell">
            <WhrSankey />
          </div>
        </div>

        <WhrScenarioCards />

        <div className="whr-charts-row">
          <div className="whr-chart-cell whr-chart-cell--wide">
            <WhrRoiChart />
          </div>
        </div>

        <WhrScoringTable />
        <WhrEquationsPanel />
      </div>
    </div>
  );
}
