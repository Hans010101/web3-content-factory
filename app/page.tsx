import type { Metadata } from "next";
import { IntelligenceDashboard } from "../components/IntelligenceDashboard";

export const metadata: Metadata = {
  title: "Web3 内容工厂",
  description: "Web3 热点发现、事实核验、内容二创、视觉生成与多账号分发工作台。",
};

export default function Home() {
  return <IntelligenceDashboard />;
}
