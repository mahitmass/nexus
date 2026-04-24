"""
PrahaariNet — Neo4j graph service.
Handles all property-graph operations: edge insertion, k-hop subgraph extraction,
snapshot queries for the dashboard, and fallback to in-memory graph if Neo4j
is unreachable (so the demo never dies on DB flakiness).
"""
import asyncio
import logging
import random
from collections import defaultdict

from neo4j import AsyncGraphDatabase

log = logging.getLogger("prahaarinet.graph")


class GraphService:
    def __init__(self, uri: str, user: str, password: str):
        self.uri = uri
        self.user = user
        self.password = password
        self.driver = None
        self.connected = False
        # In-memory fallback
        self._mem_nodes: dict[str, dict] = {}
        self._mem_edges: list[dict] = []
        self._mem_adj: dict[str, list[str]] = defaultdict(list)

    async def connect(self):
        try:
            self.driver = AsyncGraphDatabase.driver(self.uri, auth=(self.user, self.password))
            await self.driver.verify_connectivity()
            self.connected = True
            log.info(f"Connected to Neo4j at {self.uri}")
        except Exception as e:
            log.warning(f"Neo4j unreachable ({e}). Using in-memory fallback.")
            self.connected = False
        # Always seed the in-memory graph too — useful for snapshot() and speed
        self._seed_memory_graph()
        if self.connected:
            await self._seed_neo4j_graph()

    async def close(self):
        if self.driver:
            await self.driver.close()

    async def is_connected(self) -> bool:
        return self.connected

    # ---------- Seeding ---------------------------------------------------------
    def _seed_memory_graph(self, n: int = 220):
        banks = ["HDFC", "SBI", "ICICI", "AXIS", "KOTAK", "PNB"]
        names = ["rohan", "priya", "arjun", "kavya", "vikram", "anita",
                 "rahul", "deepa", "suresh", "meera", "ajay", "neha",
                 "amit", "pooja", "ravi", "sonia", "kiran", "divya",
                 "manish", "shreya"]
        for i in range(n):
            bank = banks[i % len(banks)]
            vpa = f"{names[i % len(names)]}{i}@{bank.lower()}"
            self._mem_nodes[vpa] = {
                "vpa": vpa, "bank": bank,
                "account_age_days": random.randint(30, 2000),
                "is_flagged": False,
                "kyc_tier": random.choice([1, 2, 3]),
            }
        # Sparse natural edges
        vpas = list(self._mem_nodes.keys())
        for i, v in enumerate(vpas):
            fan = random.randint(1, 3)
            for _ in range(fan):
                t = vpas[random.randint(0, n - 1)]
                if t != v:
                    self._mem_edges.append({"from": v, "to": t, "amount": random.randint(100, 20000)})
                    self._mem_adj[v].append(t)
        # Reserve special VPAs for the demo (overwrite)
        self._mem_nodes["grandma.kanta@hdfc"] = {"vpa": "grandma.kanta@hdfc", "bank": "HDFC", "account_age_days": 1500, "is_flagged": False, "kyc_tier": 1}
        self._mem_nodes["cbi.safe@upi"] = {"vpa": "cbi.safe@upi", "bank": "UNKNOWN", "account_age_days": 4, "is_flagged": False, "kyc_tier": 1}
        log.info(f"In-memory graph seeded: {len(self._mem_nodes)} nodes, {len(self._mem_edges)} edges")

    async def _seed_neo4j_graph(self):
        """Load the in-memory graph into Neo4j. Idempotent — uses MERGE."""
        try:
            async with self.driver.session() as session:
                await session.run("CREATE CONSTRAINT vpa_unique IF NOT EXISTS FOR (v:VPA) REQUIRE v.vpa IS UNIQUE")
                # Nodes
                nodes_batch = [{"vpa": n["vpa"], "bank": n["bank"], "age": n["account_age_days"], "kyc": n["kyc_tier"]}
                               for n in self._mem_nodes.values()]
                await session.run(
                    "UNWIND $nodes AS n MERGE (v:VPA {vpa: n.vpa}) "
                    "SET v.bank = n.bank, v.account_age_days = n.age, v.kyc_tier = n.kyc, v.is_flagged = false",
                    nodes=nodes_batch
                )
                # Edges
                edges_batch = [{"f": e["from"], "t": e["to"], "amt": e["amount"]} for e in self._mem_edges]
                await session.run(
                    "UNWIND $edges AS e "
                    "MATCH (a:VPA {vpa: e.f}), (b:VPA {vpa: e.t}) "
                    "MERGE (a)-[r:TRANSACTED]->(b) "
                    "ON CREATE SET r.amount = e.amt, r.timestamp = timestamp()",
                    edges=edges_batch
                )
            log.info("Neo4j seeded.")
        except Exception as e:
            log.warning(f"Neo4j seed failed: {e}. Falling back to in-memory.")
            self.connected = False

    # ---------- Operations ------------------------------------------------------
    async def insert_edge(self, sender: str, receiver: str, amount: float):
        # Always update memory
        if sender not in self._mem_nodes:
            self._mem_nodes[sender] = {"vpa": sender, "bank": "UNKNOWN", "account_age_days": 1, "is_flagged": False, "kyc_tier": 1}
        if receiver not in self._mem_nodes:
            self._mem_nodes[receiver] = {"vpa": receiver, "bank": "UNKNOWN", "account_age_days": 1, "is_flagged": False, "kyc_tier": 1}
        self._mem_edges.append({"from": sender, "to": receiver, "amount": amount, "timestamp": asyncio.get_event_loop().time()})
        self._mem_adj[sender].append(receiver)

        if self.connected:
            try:
                async with self.driver.session() as session:
                    await session.run(
                        "MERGE (a:VPA {vpa: $s}) MERGE (b:VPA {vpa: $r}) "
                        "CREATE (a)-[t:TRANSACTED {amount: $amt, timestamp: timestamp()}]->(b)",
                        s=sender, r=receiver, amt=amount
                    )
            except Exception as e:
                log.debug(f"Neo4j edge insert skipped: {e}")

    async def k_hop_subgraph(self, center: str, k: int = 2) -> dict:
        """Extract k-hop subgraph around a center node. Returns nodes + edges."""
        if self.connected:
            try:
                async with self.driver.session() as session:
                    result = await session.run(
                        f"MATCH path = (c:VPA {{vpa: $center}})-[*1..{k}]-(n) "
                        "WITH c, collect(DISTINCT n) AS neighbours "
                        "UNWIND [c] + neighbours AS v "
                        "OPTIONAL MATCH (v)-[r:TRANSACTED]->(m) "
                        "WHERE m IN [c] + neighbours "
                        "RETURN collect(DISTINCT {vpa: v.vpa, bank: v.bank, age: v.account_age_days, flagged: v.is_flagged}) AS nodes, "
                        "collect(DISTINCT {from: startNode(r).vpa, to: endNode(r).vpa, amount: r.amount, ts: r.timestamp}) AS edges",
                        center=center
                    )
                    rec = await result.single()
                    return {"nodes": rec["nodes"], "edges": [e for e in rec["edges"] if e["from"] is not None]}
            except Exception as e:
                log.debug(f"Neo4j k-hop fallback to memory: {e}")

        # In-memory BFS
        visited = {center}
        frontier = [center]
        for _ in range(k):
            new_frontier = []
            for v in frontier:
                for nb in self._mem_adj.get(v, []):
                    if nb not in visited:
                        visited.add(nb)
                        new_frontier.append(nb)
            frontier = new_frontier
        nodes = [self._mem_nodes[v] for v in visited if v in self._mem_nodes]
        edges = [e for e in self._mem_edges if e["from"] in visited and e["to"] in visited]
        return {"nodes": nodes, "edges": edges}

    async def snapshot(self, limit: int = 220) -> dict:
        """Return a pruned snapshot of the graph for initial dashboard rendering."""
        nodes = list(self._mem_nodes.values())[:limit]
        node_ids = {n["vpa"] for n in nodes}
        edges = [e for e in self._mem_edges if e["from"] in node_ids and e["to"] in node_ids]
        return {"nodes": nodes, "edges": edges}

    async def random_node_pair(self) -> tuple[str, str]:
        vpas = list(self._mem_nodes.keys())
        a, b = random.sample(vpas, 2)
        return a, b

    async def mark_flagged(self, vpas: list[str]):
        for v in vpas:
            if v in self._mem_nodes:
                self._mem_nodes[v]["is_flagged"] = True
