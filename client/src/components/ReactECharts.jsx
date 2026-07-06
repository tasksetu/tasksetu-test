// Wrapper for echarts-for-react
import React from "react";
import ReactEChartsCore from "echarts-for-react";
import * as echarts from "echarts";

export default function ReactECharts(props) {
  return <ReactEChartsCore echarts={echarts} {...props} />;
}
