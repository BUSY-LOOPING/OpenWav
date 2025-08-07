import { type RouteConfig, index, layout } from "@react-router/dev/routes";

export default [
    layout('routes/public/layout.tsx', [
        index("routes/public/home.tsx")
    ])
] satisfies RouteConfig;
