"use client";

import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import useSWR from "swr";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Smartphone,
  Monitor,
  Tablet,
  Globe,
  TrendingUp,
  Clock,
  MapPin,
  ExternalLink,
  Activity,
  Zap,
} from "lucide-react";

type AnalyticsData = {
  short_code: string;
  short_url: string;
  long_url: string;
  created_at: string;
  total_scans: number;
  scans_today: number;
  top_countries: Array<{ country: string; count: number }>;
  top_cities: Array<{ city: string; count: number }>;
  devices: {
    mobile: number;
    desktop: number;
    tablet: number;
    unknown: number;
  };
  scans_over_time: Array<{ date: string; count: number }>;
  recent_scans: Array<{
    scanned_at: string;
    country: string;
    city: string;
    device: string;
  }>;
};

const DEVICE_COLORS = {
  mobile: "hsl(var(--chart-1))",
  desktop: "hsl(var(--chart-2))",
  tablet: "hsl(var(--chart-3))",
  unknown: "hsl(var(--chart-4))",
};

const COUNTRY_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

// Fetcher function for SWR
const fetcher = async (url: string): Promise<AnalyticsData> => {
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to fetch analytics");
  }
  return res.json();
};

export default function AnalyticsPage() {
  const params = useParams();
  const code = params.code as string;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://b.ularkimsanov.com";

  // Use SWR with 30-second polling (matches Plausible Analytics)
  const { data, error, isLoading } = useSWR<AnalyticsData>(
    `${apiUrl}/api/analytics/${code}`,
    fetcher,
    {
      refreshInterval: 30000, // Poll every 30 seconds
      refreshWhenHidden: false, // Stop polling when tab is hidden
      refreshWhenOffline: false, // Stop polling when offline
      revalidateOnFocus: true, // Refresh when user focuses tab
      revalidateOnReconnect: true, // Refresh when reconnecting
      dedupingInterval: 2000, // Dedupe requests within 2 seconds
    }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            className="h-16 w-16 rounded-full border-4 border-primary/30 border-t-primary"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md text-center"
        >
          <div className="text-6xl mb-4">😕</div>
          <h1 className="text-2xl font-bold mb-2">Oops!</h1>
          <p className="text-muted-foreground mb-6">
            {error?.message || "QR code not found"}
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 text-primary hover:underline"
          >
            Go back home
            <ExternalLink className="h-4 w-4" />
          </a>
        </motion.div>
      </div>
    );
  }

  // Prepare device data for pie chart
  const deviceData = [
    { name: "Mobile", value: data.devices.mobile, icon: Smartphone },
    { name: "Desktop", value: data.devices.desktop, icon: Monitor },
    { name: "Tablet", value: data.devices.tablet, icon: Tablet },
  ].filter((d) => d.value > 0);

  const totalDevices = deviceData.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Asymmetric Hero Section - Not centered! */}
      <div className="relative overflow-hidden bg-linear-to-br from-primary/5 via-background to-accent/10">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.02]" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl"
          >
            <div className="flex items-center gap-3 mb-4">
              <Badge variant="secondary" className="flex items-center gap-1.5 px-3 py-1">
                <Activity className="h-3.5 w-3.5" />
                Live Analytics
              </Badge>
              <Badge variant="outline" className="font-mono">{code}</Badge>
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
              Your QR Code is{" "}
              <span className="bg-linear-to-r from-primary to-chart-2 bg-clip-text text-transparent">
                on fire
              </span>
              ! 🔥
            </h1>

            <p className="text-lg text-muted-foreground mb-6 max-w-2xl">
              Real-time insights into who's scanning your QR code, where they're from, and what devices they're using.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <a
                href={data.short_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium"
              >
                {data.short_url}
                <ExternalLink className="h-4 w-4" />
              </a>
              <span className="text-muted-foreground text-sm">→</span>
              <a
                href={data.long_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-foreground transition truncate max-w-md"
              >
                {data.long_url}
              </a>
            </div>
          </motion.div>

          {/* Quick Stats - Asymmetric placement */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl"
          >
            <div className="bg-card rounded-xl p-6 border shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Total Scans</span>
              </div>
              <div className="text-3xl font-bold">{data.total_scans.toLocaleString()}</div>
            </div>

            <div className="bg-card rounded-xl p-6 border shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-chart-2/10">
                  <Zap className="h-5 w-5 text-chart-2" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Today</span>
              </div>
              <div className="text-3xl font-bold">{data.scans_today.toLocaleString()}</div>
            </div>

            <div className="bg-card rounded-xl p-6 border shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-chart-3/10">
                  <Clock className="h-5 w-5 text-chart-3" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Active Since</span>
              </div>
              <div className="text-lg font-semibold">
                {new Date(data.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bento Grid Layout - Not generic three-column! */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Scans Over Time - Takes full width on mobile, 8 cols on desktop */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="lg:col-span-8"
          >
            <Card className="h-full shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Scan Activity
                </CardTitle>
                <CardDescription>Last 7 days of QR code scans</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={data.scans_over_time}>
                    <defs>
                      <linearGradient id="colorScans" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(value) =>
                        new Date(value).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                      }
                    />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="hsl(var(--chart-1))"
                      strokeWidth={2}
                      fill="url(#colorScans)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>

          {/* Device Breakdown - 4 cols on desktop */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="lg:col-span-4"
          >
            <Card className="h-full shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-chart-1" />
                  Device Types
                </CardTitle>
                <CardDescription>How users are scanning</CardDescription>
              </CardHeader>
              <CardContent>
                {totalDevices > 0 ? (
                  <div className="space-y-4">
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={deviceData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {deviceData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={DEVICE_COLORS[entry.name.toLowerCase() as keyof typeof DEVICE_COLORS]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>

                    <div className="space-y-2">
                      {deviceData.map((device) => {
                        const Icon = device.icon;
                        const percentage = ((device.value / totalDevices) * 100).toFixed(1);
                        return (
                          <div key={device.name} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" style={{ color: DEVICE_COLORS[device.name.toLowerCase() as keyof typeof DEVICE_COLORS] }} />
                              <span className="text-sm font-medium">{device.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">{device.value}</span>
                              <Badge variant="secondary" className="text-xs">{percentage}%</Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                    <Smartphone className="h-12 w-12 mb-2 opacity-20" />
                    <p className="text-sm">No device data yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Top Countries - 5 cols */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="lg:col-span-5"
          >
            <Card className="h-full shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-chart-2" />
                  Top Countries
                </CardTitle>
                <CardDescription>Geographic distribution of scans</CardDescription>
              </CardHeader>
              <CardContent>
                {data.top_countries.length > 0 ? (
                  <div className="space-y-3">
                    {data.top_countries.slice(0, 5).map((country: { country: string; count: number }, index: number) => (
                      <div key={country.country} className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{country.country}</span>
                            <span className="text-sm text-muted-foreground">{country.count}</span>
                          </div>
                          <div className="h-2 bg-secondary rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${(country.count / data.total_scans) * 100}%` }}
                              transition={{ duration: 1, delay: 0.5 + index * 0.1 }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: COUNTRY_COLORS[index % COUNTRY_COLORS.length] }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                    <Globe className="h-12 w-12 mb-2 opacity-20" />
                    <p className="text-sm">No geographic data yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Top Cities - 7 cols */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="lg:col-span-7"
          >
            <Card className="h-full shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-chart-3" />
                  Top Cities
                </CardTitle>
                <CardDescription>Where your scans are happening</CardDescription>
              </CardHeader>
              <CardContent>
                {data.top_cities.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={data.top_cities.slice(0, 5)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis
                        dataKey="city"
                        type="category"
                        tick={{ fill: "hsl(var(--muted-foreground))" }}
                        width={100}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="count" fill="hsl(var(--chart-3))" radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                    <MapPin className="h-12 w-12 mb-2 opacity-20" />
                    <p className="text-sm">No city data yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
