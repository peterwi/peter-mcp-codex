# TIG Network Architecture Documentation

**Document Version:** 1.0
**Last Updated:** October 31, 2025
**Network Type:** VXLAN/EVPN Fabric with RoCE Support

---

## Table of Contents

1. [Network Overview](#network-overview)
2. [Topology](#topology)
3. [Switch Inventory](#switch-inventory)
4. [IP Addressing Scheme](#ip-addressing-scheme)
5. [OSPF Underlay Configuration](#ospf-underlay-configuration)
6. [BGP EVPN Overlay Configuration](#bgp-evpn-overlay-configuration)
7. [VXLAN Configuration](#vxlan-configuration)
8. [vPC Configuration](#vpc-configuration)
9. [VRF Configuration](#vrf-configuration)
10. [QoS and RoCE Configuration](#qos-and-roce-configuration)
11. [Design Considerations](#design-considerations)

---

## Network Overview

### Architecture Type
**Two-tier Cisco VXLAN/EVPN fabric** with BGP EVPN control plane and OSPF underlay routing.

### Key Features
- **Underlay:** OSPF (process name: UNDERLAY) with BFD for fast failure detection
- **Overlay:** BGP EVPN (AS 64996) with route reflector spines
- **Encapsulation:** VXLAN with ingress replication
- **High Availability:** vPC (Virtual Port Channel) dual-homing for all server connections
- **QoS:** Priority Flow Control (PFC) and Explicit Congestion Notification (ECN) for RoCE v2
- **MTU:** 9216 bytes (jumbo frames) throughout fabric

### Scale
- **Spine Switches:** 2 (400G per port)
- **Leaf Switches:** 10 (8 ToR + 2 Border Leaf)
- **Racks:** 5 (6A4, 6A5, 6A6, 6A7, 6A8)
- **Server Dual-Homing:** All servers connected via vPC bonds (2x100G or 2x200G)

---

## Topology

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                           SPINE LAYER (Route Reflectors)                                    │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│        SS1-TIG-6A21-R200-DIVA                       SS2-TIG-6A21-R200-DIVA                 │
│        Router ID: 192.168.0.1                       Router ID: 192.168.0.2                 │
│        BGP RR (Cluster 64996)                       BGP RR (Cluster 64996)                 │
│                                                                                             │
│           │ │ │ │ │                                     │ │ │ │ │                          │
│           └─┼─┼─┼─┼─────────────────────────────────────┼─┼─┼─┼─┘                          │
│             └─┼─┼─┼───────────────────────────────────┬─┼─┼─┼─┘                            │
│               └─┼─┼─────────────────────────────────┬─┼─┼─┼─┘                              │
│                 └─┼───────────────────────────────┬─┼─┼─┼─┘                                │
│                   └─────────────────────────────┬─┼─┼─┼─┘                                  │
│                                                 │ │ │ │ │                                  │
└─────────────────────────────────────────────────┼─┼─┼─┼─┼──────────────────────────────────┘
                                                  │ │ │ │ │
                            400G Links (2x per leaf, ECMP load balanced)
                                                  │ │ │ │ │
┌─────────────────────────────────────────────────┼─┼─┼─┼─┼──────────────────────────────────┐
│                           LEAF LAYER (VTEP Endpoints)                                       │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│    ┌─ Rack 6A4 ─┐   ┌─ Rack 6A5 ─┐   ┌─ Rack 6A6 ─┐   ┌─ Rack 6A7 ─┐   ┌─ Rack 6A8 ─┐   │
│                                                                                             │
│      LS1a-6A4         LS1a-6A5         LS1a-6A6         LS1a-6A7         BL1a-6A8         │
│      192.168.0.9      192.168.0.5      192.168.0.8      192.168.0.7      192.168.0.3      │
│      VTEP: .1.3       VTEP: .1.9       VTEP: .1.12      VTEP: .1.15      VTEP: .1.1       │
│      vPC Domain 1     vPC Domain 2     vPC Domain 3     vPC Domain 5     vPC Domain 6     │
│          │ │              │ │              │ │              │ │              │ │           │
│          │ │              │ │              │ │              │ │              │ │           │
│      [Po500 Peer-Link][Po500 Peer-Link][Po500 Peer-Link][Po500 Peer-Link][Po500 Peer-Lnk]│
│          │ │              │ │              │ │              │ │              │ │           │
│          │ │              │ │              │ │              │ │              │ │           │
│      LS1b-6A4         LS1b-6A5         LS1b-6A6         LS1b-6A7         BL1b-6A8         │
│      192.168.0.12     192.168.0.6      192.168.0.10     192.168.0.11     192.168.0.4      │
│      VTEP: .1.4       VTEP: .1.10      VTEP: .1.13      VTEP: .1.16      VTEP: .1.2       │
│      vPC Domain 1     vPC Domain 2     vPC Domain 3     vPC Domain 5     vPC Domain 6     │
│                                                                                             │
│      Anycast VTEP:    Anycast VTEP:    Anycast VTEP:    Anycast VTEP:    Anycast VTEP:   │
│      192.168.1.5      192.168.1.11     192.168.1.14     192.168.1.17     192.168.1.6      │
│          │ │              │ │              │ │              │ │              │ │           │
│          ▼ ▼              ▼ ▼              ▼ ▼              ▼ ▼              ▼ ▼           │
│    ┌───────────┐     ┌───────────┐     ┌───────────┐     ┌───────────┐     ┌───────────┐ │
│    │  Servers  │     │  Servers  │     │  Servers  │     │  Servers  │     │  Border   │ │
│    │ 2x100G or │     │ 2x100G or │     │ 2x100G or │     │  2x200G   │     │  Gateway  │ │
│    │2x200G vPC │     │2x200G vPC │     │2x200G vPC │     │ vPC bonds │     │ Functions │ │
│    └───────────┘     └───────────┘     └───────────┘     └───────────┘     └───────────┘ │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

Legend:
  - All VTEP addresses shown as abbreviated (e.g., .1.3 = 192.168.1.3)
  - vPC peer-link: Typically 2x100G or 2x400G (Port-Channel 500)
  - Each leaf has 2x400G uplinks (one to each spine for ECMP)
  - Total fabric capacity per leaf: 800 Gbps bidirectional
```

### Physical Connectivity

**Spine-to-Leaf Connections:**
- Each spine connects to all 10 leaf switches via 400G interfaces
- Each leaf has 2x400G uplinks (one to each spine)
- Total spine uplink capacity per leaf: 800 Gbps (bidirectional ECMP)

**Leaf-to-Server Connections:**
- Servers dual-homed via vPC bonds (2x100G or 2x200G per server)
- Port-channels configured in trunk mode with native VLAN per workload

---

## Switch Inventory

### Spine Switches

| Hostname | Role | Router ID | Loopback0 | Management IP | BGP Role | OSPF Area |
|----------|------|-----------|-----------|---------------|----------|-----------|
| SS1-TIG-6A21-R200-DIVA | Spine 1 | 192.168.0.1 | 192.168.0.1/32 | 10.253.16.10 | Route Reflector | 0.0.0.0 |
| SS2-TIG-6A21-R200-DIVA | Spine 2 | 192.168.0.2 | 192.168.0.2/32 | 10.253.16.11 | Route Reflector | 0.0.0.0 |

**Spine Functions:**
- BGP Route Reflectors for EVPN control plane (cluster-id 64996)
- OSPF backbone for underlay IP reachability
- No VXLAN termination (no VTEPs on spines)
- Maximum ECMP paths: 64 (BGP), 8 (OSPF)

### Leaf Switches (ToR)

| Hostname | Rack | Router ID | Loopback0 | VTEP Loopback1 | vPC Domain | vPC Anycast VTEP | Management IP |
|----------|------|-----------|-----------|----------------|------------|------------------|---------------|
| LS1a-TIG-6A7-R200-DIVA | 6A7 | 192.168.0.7 | 192.168.0.7/32 | 192.168.1.15/32 | 5 | 192.168.1.17 | 10.253.16.14 |
| LS1b-TIG-6A7-R200-DIVA | 6A7 | 192.168.0.11 | 192.168.0.11/32 | 192.168.1.16/32 | 5 | 192.168.1.17 | 10.253.16.15 |
| LS1a-TIG-6A6-R200-DIVA | 6A6 | 192.168.0.8 | 192.168.0.8/32 | 192.168.1.12/32 | 3 | 192.168.1.14 | 10.253.16.16 |
| LS1b-TIG-6A6-R200-DIVA | 6A6 | 192.168.0.10 | 192.168.0.10/32 | 192.168.1.13/32 | 3 | 192.168.1.14 | 10.253.16.17 |
| LS1a-TIG-6A5-R200-DIVA | 6A5 | 192.168.0.5 | 192.168.0.5/32 | 192.168.1.9/32 | 2 | 192.168.1.11 | 10.253.16.18 |
| LS1b-TIG-6A5-R200-DIVA | 6A5 | 192.168.0.6 | 192.168.0.6/32 | 192.168.1.10/32 | 2 | 192.168.1.11 | 10.253.16.19 |
| LS1a-TIG-6A4-R200-DIVA | 6A4 | 192.168.0.9 | 192.168.0.9/32 | 192.168.1.3/32 | 1 | 192.168.1.5 | 10.253.16.20 |
| LS1b-TIG-6A4-R200-DIVA | 6A4 | 192.168.0.12 | 192.168.0.12/32 | 192.168.1.4/32 | 1 | 192.168.1.5 | 10.253.16.21 |

**ToR Leaf Functions:**
- VXLAN Tunnel Endpoints (VTEPs) for overlay encapsulation
- Server connectivity via vPC dual-homing
- EVPN BGP clients (peers with both spine route reflectors)
- L2 VXLAN bridging and L3 VRF routing (SVI gateways)

### Border Leaf Switches

| Hostname | Rack | Router ID | Loopback0 | VTEP Loopback1 | vPC Domain | vPC Anycast VTEP | Management IP |
|----------|------|-----------|-----------|----------------|------------|------------------|---------------|
| BL1a-TIG-6A8-R200-DIVA | 6A8 | 192.168.0.3 | 192.168.0.3/32 | 192.168.1.1/32 | 6 | 192.168.1.6 | 10.253.16.12 |
| BL1b-TIG-6A8-R200-DIVA | 6A8 | 192.168.0.4 | 192.168.0.4/32 | 192.168.1.2/32 | 6 | 192.168.1.6 | 10.253.16.13 |

**Border Leaf Functions:**
- Same as ToR leafs (VTEP, server connectivity)
- Border gateway functions (external connectivity if configured)
- L3 VRF route leaking between fabric and external networks

---

## IP Addressing Scheme

### Loopback Addressing

**Loopback0 (OSPF Router ID / BGP Router ID):**
- Range: 192.168.0.0/24
- Purpose: OSPF router ID, BGP router ID, BGP update-source
- Advertised into OSPF Area 0

**Loopback1 (VTEP Source Interface):**
- Range: 192.168.1.0/24
- Purpose: VXLAN source interface (primary and anycast secondary)
- Advertised into OSPF Area 0
- vPC pairs share a secondary anycast IP on Loopback1

**Loopback2/3 (VRF Loopbacks):**
- Range: 192.168.6.0/24
- Purpose: VRF-specific loopbacks for route advertisement
- Tagged with route-tag 12345 for redistribution

### Fabric Link Addressing (Point-to-Point /31)

**Spine-to-Leaf Links:**
- Range: 192.168.3.0/24
- Subnet size: /31 (RFC 3021 - point-to-point links)
- Pattern: Sequential allocation starting from .40

**Example (Rack 6A7):**
```
SS1 Eth1/3 (.40) ↔ LS1a Eth1/29 (.41)  # Subnet .40-.41
SS1 Eth1/4 (.42) ↔ LS1b Eth1/29 (.43)  # Subnet .42-.43
SS2 Eth1/3 (.44) ↔ LS1a Eth1/30 (.45)  # Subnet .44-.45
SS2 Eth1/4 (.46) ↔ LS1b Eth1/30 (.47)  # Subnet .46-.47
```

### Complete Fabric Link Addressing Table

| Source | Source Int | Source IP | Dest | Dest Int | Dest IP | Subnet |
|--------|-----------|-----------|------|----------|---------|--------|
| SS1 | Eth1/1 | 192.168.3.0/31 | BL1a | Eth1/33 | 192.168.3.1/31 | .0-.1 |
| SS1 | Eth1/2 | 192.168.3.4/31 | BL1b | Eth1/33 | 192.168.3.5/31 | .4-.5 |
| SS1 | Eth1/3 | 192.168.3.40/31 | LS1a-6A7 | Eth1/29 | 192.168.3.41/31 | .40-.41 |
| SS1 | Eth1/4 | 192.168.3.42/31 | LS1b-6A7 | Eth1/29 | 192.168.3.43/31 | .42-.43 |
| SS1 | Eth1/5 | 192.168.4.11/31 | LS1a-6A6 | Eth1/29 | 192.168.4.10/31 | .10-.11 |
| SS1 | Eth1/6 | 192.168.4.1/31 | LS1b-6A6 | Eth1/29 | 192.168.4.0/31 | .0-.1 |
| SS1 | Eth1/7 | 192.168.4.7/31 | LS1a-6A5 | Eth1/29 | 192.168.4.6/31 | .6-.7 |
| SS1 | Eth1/8 | 192.168.4.17/31 | LS1b-6A5 | Eth1/29 | 192.168.4.16/31 | .16-.17 |
| SS1 | Eth1/9 | 192.168.3.32/31 | LS1a-6A4 | Eth1/29 | 192.168.3.33/31 | .32-.33 |
| SS1 | Eth1/10 | 192.168.3.36/31 | LS1b-6A4 | Eth1/29 | 192.168.3.37/31 | .36-.37 |
| SS2 | Eth1/1 | 192.168.3.2/31 | BL1a | Eth1/34 | 192.168.3.3/31 | .2-.3 |
| SS2 | Eth1/2 | 192.168.3.6/31 | BL1b | Eth1/34 | 192.168.3.7/31 | .6-.7 |
| SS2 | Eth1/3 | 192.168.3.44/31 | LS1a-6A7 | Eth1/30 | 192.168.3.45/31 | .44-.45 |
| SS2 | Eth1/4 | 192.168.3.46/31 | LS1b-6A7 | Eth1/30 | 192.168.3.47/31 | .46-.47 |
| SS2 | Eth1/5 | 192.168.4.9/31 | LS1a-6A6 | Eth1/30 | 192.168.4.8/31 | .8-.9 |
| SS2 | Eth1/6 | 192.168.4.3/31 | LS1b-6A6 | Eth1/30 | 192.168.4.2/31 | .2-.3 |
| SS2 | Eth1/7 | 192.168.4.13/31 | LS1a-6A5 | Eth1/30 | 192.168.4.12/31 | .12-.13 |
| SS2 | Eth1/8 | 192.168.4.5/31 | LS1b-6A5 | Eth1/30 | 192.168.4.4/31 | .4-.5 |
| SS2 | Eth1/9 | 192.168.3.34/31 | LS1a-6A4 | Eth1/30 | 192.168.3.35/31 | .34-.35 |
| SS2 | Eth1/10 | 192.168.3.38/31 | LS1b-6A4 | Eth1/30 | 192.168.3.39/31 | .38-.39 |

**Note:** Some addresses use 192.168.4.0/24 range due to exhaustion of 192.168.3.0/24 sequential allocation.

### Management Addressing

- Range: 10.253.16.0/24
- VRF: management
- Used for SSH, SNMP, and out-of-band management

### vPC Peer-Keepalive

- Uses management VRF
- UDP port 3200
- Interval: 1000ms, Timeout: 5 seconds
- Example: LS1a (10.253.16.14) ↔ LS1b (10.253.16.15)

---

## OSPF Underlay Configuration

### Purpose
OSPF provides **IP reachability** for the underlay network, enabling BGP EVPN sessions between loopback0 addresses.

### Key Parameters

**Process Name:** `UNDERLAY`
**AS Number (for reference):** Not applicable (OSPF doesn't use AS)
**Area:** 0.0.0.0 (backbone)
**Authentication:** MD5 message-digest (area-wide)
**Network Type:** Point-to-point on all fabric interfaces

### Configuration Details

**On Spine Switches:**
```cisco
router ospf UNDERLAY
  bfd                                  # Bidirectional Forwarding Detection
  router-id 192.168.0.1                # Loopback0 IP
  graceful-restart
  graceful-restart grace-period 60
  max-metric router-lsa on-startup 600 # Avoid blackholing during bootup
  log-adjacency-changes
  area 0.0.0.0 authentication message-digest
  timers throttle spf 200 1000 5000    # Fast convergence
  timers lsa-arrival 1000
  timers throttle lsa 0 5000 5000
  distance 110
  maximum-paths 8                      # ECMP for up to 8 paths
  auto-cost reference-bandwidth 40 Gbps
  discard-route external
  discard-route internal
```

**On Leaf Switches:**
- Same configuration as spine
- Each leaf peers with both spines via 2x400G uplinks
- OSPF adjacencies on Ethernet1/29 (to SS1) and Ethernet1/30 (to SS2)

### Interface Configuration Example

**Spine SS1 → Leaf LS1a:**
```cisco
interface Ethernet1/3
  description LS1A-TIG-6A7-1/29
  mtu 9216
  ip address 192.168.3.40/31
  ip ospf message-digest-key 1 md5 3 <encrypted>
  ip ospf network point-to-point
  ip router ospf UNDERLAY area 0.0.0.0
  no shutdown
```

**Leaf LS1a → Spine SS1:**
```cisco
interface Ethernet1/29
  description connected-to-SS1-TIG-6A21-R200-DIVA-Ethernet1/3
  mtu 9216
  port-type fabric
  ip address 192.168.3.41/31
  ip ospf message-digest-key 1 md5 3 <encrypted>
  ip ospf network point-to-point
  ip router ospf UNDERLAY area 0.0.0.0
  no shutdown
```

### OSPF Timers

- **Hello Interval:** 10 seconds
- **Dead Interval:** 40 seconds
- **SPF Throttle:** 200ms initial, 1000ms hold, 5000ms max-wait
- **BFD:** Enabled for sub-second failure detection

### Advertised Routes

**Into OSPF:**
- Loopback0 (router ID)
- Loopback1 (VTEP source)
- Fabric point-to-point links (192.168.3.0/24)

**NOT Advertised:**
- VRF loopbacks (Loopback2/3) - handled by BGP
- Server-facing VLANs/SVIs - overlay only

---

## BGP EVPN Overlay Configuration

### Purpose
BGP EVPN provides the **control plane** for MAC/IP learning and distribution across the VXLAN fabric.

### Architecture

**Topology:** Route Reflector (RR) with spines as RRs, leafs as clients
**AS Number:** 64996 (iBGP)
**Address Family:** L2VPN EVPN
**Route Distinguisher:** Auto-generated (dual mode)
**Route Target:** Auto-generated (import/export)

### Spine Configuration (Route Reflector)

**On SS1/SS2:**
```cisco
router bgp 64996
  router-id 192.168.0.1                # Loopback0
  cluster-id 64996                     # RR cluster identifier
  reference-bandwidth 40000
  timers bgp 60 180
  graceful-restart
  graceful-restart restart-time 120
  graceful-restart stalepath-time 300
  reconnect-interval 60
  log-neighbor-changes
  rd dual

  address-family ipv4 unicast
    maximum-paths 64
    maximum-paths ibgp 64
    client-to-client reflection
    distance 20 200 220

  template peer LS-IBGP-EVPN
    remote-as 64996
    update-source loopback0            # Source from Loopback0
    timers 60 180
    dscp 48                            # QoS marking for BGP packets
    address-family l2vpn evpn
      send-community
      send-community extended
      route-reflector-client           # Leafs are RR clients

  neighbor 192.168.0.3
    inherit peer LS-IBGP-EVPN
    description BL1A-TIG-6A8-R200-DIVA

  neighbor 192.168.0.4
    inherit peer LS-IBGP-EVPN
    description BL1B-TIG-6A8-R200-DIVA

  # ... (neighbors for all 10 leaf switches)
```

**Spine BGP Neighbors:** 11 total
- 2 border leafs (BL1a, BL1b in rack 6A8)
- 8 ToR leafs (LS1a/LS1b in racks 6A4-6A7)
- Spine-to-spine peering (192.168.0.2)

### Leaf Configuration (Route Reflector Client)

**On LS1a (example):**
```cisco
router bgp 64996
  router-id 192.168.0.7                # Loopback0
  timers bgp 60 180
  graceful-restart
  graceful-restart restart-time 120
  rd dual

  address-family l2vpn evpn
    maximum-paths 1                    # EVPN typically single best path

  template peer SS-IBGP-EVPN
    remote-as 64996
    update-source loopback0
    timers 60 180
    dscp 48
    address-family l2vpn evpn
      send-community
      send-community extended

  neighbor 192.168.0.1
    inherit peer SS-IBGP-EVPN
    description SS1-TIG-6A21-R200-DIVA

  neighbor 192.168.0.2
    inherit peer SS-IBGP-EVPN
    description SS2-TIG-6A21-R200-DIVA

  vrf tig-base
    address-family ipv4 unicast
      advertise l2vpn evpn
      redistribute direct route-map fabric-rmap-redist-subnet
```

### BGP EVPN Route Types

The fabric uses standard EVPN route types:

1. **Type 2 (MAC/IP Advertisement):**
   - Advertises MAC addresses learned locally
   - Includes IP address if host sends ARP/ND
   - Used for Layer 2 forwarding across fabric

2. **Type 3 (Inclusive Multicast Route):**
   - Advertises VTEP reachability for BUM traffic
   - Enables ingress replication for multicast/broadcast

3. **Type 5 (IP Prefix Route):**
   - Advertises IP prefixes from VRFs
   - Used for inter-VRF routing and external connectivity

### BGP Timers

- **Keepalive:** 60 seconds
- **Hold Time:** 180 seconds
- **Graceful Restart Time:** 120 seconds
- **Stale Path Time:** 300 seconds
- **Reconnect Interval:** 60 seconds

---

## VXLAN Configuration

### Overview

VXLAN (Virtual Extensible LAN) provides Layer 2 overlay tunnels across the Layer 3 IP fabric.

**Encapsulation:** UDP port 4789
**Replication:** Ingress replication (no multicast in underlay)
**MTU:** 9216 bytes (accommodates VXLAN overhead)

### Network Virtualization Endpoint (NVE) Interface

**On Leaf Switches:**
```cisco
interface nve1
  no shutdown
  host-reachability protocol bgp      # Use BGP EVPN for MAC learning
  advertise virtual-rmac              # Advertise vPC virtual router MAC
  source-interface loopback1          # VTEP source (anycast secondary)
  source-interface hold-down-time 180

  member vni 30002
    ingress-replication protocol bgp

  member vni 30003
    ingress-replication protocol bgp

  # ... (additional VNIs for each VLAN)

  member vni 30018
    ingress-replication protocol bgp
```

### VLAN to VNI Mapping

**Layer 2 VNI (per VLAN):**

| VLAN | VNI | Description | VRF | Usage |
|------|-----|-------------|-----|-------|
| 134 | 30010 | Workload VLAN | tig-base | Server workload |
| 135 | 30011 | Workload VLAN | tig-base | Server workload |
| 147 | 30018 | Workload VLAN | tig-base | Server workload (latpoc33) |
| 150 | 30021 | Workload VLAN | tig-base | Server workload |
| 151 | 30022 | Workload VLAN | tig-base | Server workload |
| 152 | 30023 | Workload VLAN | tig-base | Server workload |
| ... | ... | ... | ... | ... |

**VLAN Configuration:**
```cisco
vlan 147
  vn-segment 30018                    # Map VLAN 147 to VNI 30018
```

**Layer 3 VNI (per VRF):**

| VRF | L3 VNI | Loopback | Description |
|-----|--------|----------|-------------|
| tig-base | 50000 | Loopback2 | Primary tenant VRF |
| tig-restricted | 50001 | Loopback3 | Restricted VRF |

### SVI (Switched Virtual Interface) Configuration

**Example VLAN 147 Gateway:**
```cisco
interface Vlan147
  description int_vlan_147
  no shutdown
  mtu 9216
  vrf member tig-base                # Associate with VRF
  ip address 10.147.x.1/24           # Default gateway for servers
  fabric forwarding mode anycast-gateway # vPC anycast gateway
```

### Anycast Gateway (vPC)

- Both vPC peers share the same SVI IP address
- Servers see single consistent gateway IP regardless of which leaf they're talking to
- Uses `fabric forwarding mode anycast-gateway`

---

## vPC Configuration

### Purpose

vPC (Virtual Port Channel) provides **server dual-homing** without Spanning Tree Protocol (STP) blocked ports.

### vPC Domain Design

Each rack's leaf pair forms a vPC domain:

| Rack | vPC Domain | Primary | Secondary | Peer-Link | Keepalive IPs |
|------|------------|---------|-----------|-----------|---------------|
| 6A4 | 1 | LS1a | LS1b | Po500 | 10.253.16.20 ↔ 10.253.16.21 |
| 6A5 | 2 | LS1a | LS1b | Po500 | 10.253.16.18 ↔ 10.253.16.19 |
| 6A6 | 3 | LS1a | LS1b | Po500 | 10.253.16.16 ↔ 10.253.16.17 |
| 6A7 | 5 | LS1a | LS1b | Po500 | 10.253.16.14 ↔ 10.253.16.15 |
| 6A8 | 6 | BL1a | BL1b | Po500 | 10.253.16.12 ↔ 10.253.16.13 |

### vPC Configuration Example

**On LS1a-TIG-6A7 (vPC Primary):**
```cisco
vpc domain 5
  peer-switch                         # Appear as single logical switch
  role priority 32667                 # Lower = primary (LS1a)
  system-priority 32667
  peer-keepalive destination 10.253.16.15 source 10.253.16.14
    udp-port 3200 vrf management interval 1000 timeout 5
  delay restore 150                   # Wait before restoring vPCs after reload
  peer-gateway                        # Route for each other's MAC
  graceful consistency-check          # Warn on config mismatches
  auto-recovery reload-delay 360      # Auto-recover after dual failure
  delay restore interface-vlan 10
  ip arp synchronize                  # Sync ARP tables between peers
```

**On LS1b-TIG-6A7 (vPC Secondary):**
- Same configuration except `role priority 32768` (higher = secondary)

### vPC Peer-Link Configuration

**Physical Links:**
- Typically 2x100G or 2x400G Ethernet interfaces
- Configured as Port-Channel 500

**Configuration:**
```cisco
interface port-channel500
  description vPC peer-link
  switchport mode trunk
  switchport trunk allowed vlan 1,59,134-162,701,801,901,2000-2001,3600
  spanning-tree port type network
  vpc peer-link
```

**Member Interfaces:**
```cisco
interface Ethernet1/31
  description vPC peer-link member
  switchport mode trunk
  channel-group 500 mode active
  no shutdown

interface Ethernet1/32
  description vPC peer-link member
  switchport mode trunk
  channel-group 500 mode active
  no shutdown
```

### Server-Facing vPC Port-Channel

**Example: Po13 for latpoc33 server:**
```cisco
interface port-channel13
  description po-latpoc33
  switchport mode trunk
  switchport access vlan 1
  switchport trunk native vlan 147
  switchport trunk allowed vlan 147
  priority-flow-control mode on       # RoCE PFC
  vpc 13                               # vPC identifier
```

**Member on LS1a:**
```cisco
interface Ethernet1/4/1
  description latpoc33-port1
  switchport mode trunk
  channel-group 13 mode active
  no shutdown
```

**Member on LS1b:**
```cisco
interface Ethernet1/4/1
  description latpoc33-port2
  switchport mode trunk
  channel-group 13 mode active
  no shutdown
```

### vPC Fast Convergence

- **ARP Synchronization:** Enabled (`ip arp synchronize`)
- **Delay Restore:** 150 seconds for vPCs, 10 seconds for SVIs
- **Auto-Recovery:** 360 seconds after dual-failure
- **BFD on fabric links:** Sub-second failure detection

---

## VRF Configuration

### Purpose

VRFs (Virtual Routing and Forwarding) provide **network segmentation** for multi-tenancy.

### VRF Definitions

**VRF: tig-base (Primary Tenant)**
```cisco
vrf context tig-base
  description tig_base_vrf
  vni 50000                           # L3 VNI for inter-subnet routing
  rd auto                             # Auto-generate route distinguisher
  address-family ipv4 unicast
    route-target both auto            # Auto-generate RT
    route-target both auto evpn       # EVPN-specific RT
  address-family ipv6 unicast
    route-target both auto
    route-target both auto evpn
```

**VRF: tig-restricted (Restricted Tenant)**
```cisco
vrf context tig-restricted
  description restricted
  vni 50001
  rd auto
  address-family ipv4 unicast
    route-target both auto
    route-target both auto evpn
```

### VRF Loopbacks

**Loopback per VRF for route advertisement:**
```cisco
interface loopback2
  vrf member tig-base
  ip address 192.168.6.11/32 tag 12345

interface loopback3
  vrf member tig-restricted
  ip address 192.168.6.8/32 tag 12345
```

### VRF Route Redistribution

**In BGP:**
```cisco
router bgp 64996
  vrf tig-base
    address-family ipv4 unicast
      advertise l2vpn evpn            # Advertise VRF routes into EVPN
      redistribute direct route-map fabric-rmap-redist-subnet
```

**Route-Map:**
```cisco
route-map fabric-rmap-redist-subnet permit 10
  match tag 12345                     # Only redistribute tagged routes
```

### Inter-VRF Routing

- Not enabled by default (VRFs are isolated)
- If needed, configure route leaking on border leafs or external firewall

---

## QoS and RoCE Configuration

### Purpose

Quality of Service (QoS) ensures **lossless Ethernet** for RDMA over Converged Ethernet (RoCE) v2 traffic.

### Key Technologies

1. **Priority Flow Control (PFC):** IEEE 802.1Qbb - per-priority pause frames
2. **Explicit Congestion Notification (ECN):** Mark packets before queue drops
3. **Data Center QoS (DCQOS):** NX-OS QoS framework

### Global QoS Configuration

**Enable QoS Features:**
```cisco
class-map type queuing match-any q-rdma
  match qos-group 3

policy-map type queuing QOS_QUEUING_FABRIC
  class type queuing q-rdma
    bandwidth remaining percent 50     # 50% bandwidth for RoCE queue
    random-detect minimum-threshold 150 kbytes
    random-detect maximum-threshold 3000 kbytes
    random-detect drop-probability 7
  class type queuing class-default
    bandwidth remaining percent 50

class-map type network-qos match-any q3
  match qos-group 3

policy-map type network-qos QOS_NW_FABRIC
  class type network-qos q3
    mtu 9216
    pause pfc-cos 3                   # Enable PFC on CoS 3
  class type network-qos class-default
    mtu 9216

system qos
  service-policy type queuing output QOS_QUEUING_FABRIC
  service-policy type network-qos QOS_NW_FABRIC
```

### Interface-Level QoS

**On Fabric Interfaces (Spine-Leaf Links):**
```cisco
interface Ethernet1/29
  priority-flow-control mode on
  priority-flow-control watch-dog-interval on
  service-policy type qos input QOS_MARKING
```

**On Server-Facing Interfaces:**
```cisco
interface port-channel13
  priority-flow-control mode on
  service-policy type qos input QOS_MARKING
```

**On NVE1 Interface (VXLAN Decapsulation - Leafs/Borderleafs Only):**
```cisco
interface nve1
  service-policy type qos input QOS_MARKING
```

**⚠️ CRITICAL FOR VXLAN FABRICS:**

The `nve1` interface handles VXLAN encapsulation/decapsulation on VTEP nodes. Without QOS_MARKING policy on nve1, decapsulated RoCE traffic loses its qos-group classification.

**Why this is needed:**
1. RoCE traffic enters leaf/borderleaf with DSCP 26 → classified to qos-group 3 ✅
2. Traffic encapsulated in VXLAN, routed through spine ✅
3. **Destination leaf decapsulates on nve1** → inner packet emerges with DSCP 26
4. **Without QOS_MARKING on nve1:** Packet gets qos-group 0 (default) ❌
5. **Result:** No PFC protection → packet drops under load → performance collapse

**Apply to:**
- ✅ Leaf switches (VTEP nodes with L2 VNIs)
- ✅ Borderleaf switches (VTEP nodes)
- ❌ NOT spine switches (they route encapsulated packets, don't decapsulate)

**Verification:**
```bash
show run interface nve1 | include service-policy
# Expected output: service-policy type qos input QOS_MARKING
```

### ECN Thresholds

**Per Cisco CVD for AI/ML:**
- **Minimum Threshold:** 150 KB
- **Maximum Threshold:** 3000 KB (3 MB)
- **Drop Probability:** 7 (percentage at max threshold)

**Rationale:**
- Mark packets with ECN before queue fills
- Senders reduce transmission rate proactively
- Avoids hard packet drops and retransmissions

### PFC Watchdog

**Purpose:** Detect and recover from PFC storms (stuck pause frames)

**Configuration:**
```cisco
priority-flow-control watch-dog-interval on

# Global PFC watchdog settings
# Poll interval: 100ms
# Shutdown multiplier: 1 (shutdown after 100ms of pause)
# Auto-restore multiplier: 10 (restore after 1000ms)
```

### CoS-to-Queue Mapping

| CoS | Queue | Description | Bandwidth | ECN |
|-----|-------|-------------|-----------|-----|
| 0 | q-default | Best effort | 50% | No |
| 3 | q-rdma | RoCE traffic | 50% | Yes |

**DSCP Marking:**
- RoCE traffic: DSCP 26 (AF31) → CoS 3
- BGP traffic: DSCP 48 (CS6)

---

## Design Considerations

### ECMP Load Balancing

**Hash Algorithm:** `src-dst ip-l4port`
- Uses source/destination IP and TCP/UDP port for flow distribution
- Provides good load distribution for TCP-based workloads
- Rotate disabled (rotate 0)

**Verification:**
- Each leaf should have 2 ECMP paths to anycast loopback (192.168.1.X/32)
- Both spine uplinks should carry roughly equal traffic

### MTU Sizing

**9216 bytes throughout fabric:**
- Accommodates VXLAN overhead (50 bytes)
- Enables jumbo frames for storage/HPC workloads
- Critical for RoCE performance

**VXLAN Overhead:**
- Original Ethernet frame: 1500 bytes (standard) or 9000 bytes (jumbo)
- Outer IP header: 20 bytes
- Outer UDP header: 8 bytes
- VXLAN header: 8 bytes
- Outer Ethernet header: 14 bytes
- **Total overhead:** 50 bytes

### Failure Domains

**Single Switch Failure:**
- vPC ensures server connectivity via peer switch
- OSPF/BGP reconverge via remaining spine
- Sub-second failure detection with BFD

**Single Spine Failure:**
- All leafs continue forwarding via remaining spine
- 50% reduction in fabric capacity (still sufficient for 100G server bonds)
- No packet loss with proper ECMP implementation

**Dual vPC Peer Failure:**
- Auto-recovery after 360 seconds
- Server bonds fail over to standby uplinks (if configured)

### Scalability Limits

**Current Scale:**
- 2 spines, 10 leafs
- ~50-100 servers (estimated)
- VLANs: 134-162, 701, 801, 901, 2000-2001, 3600
- VNIs: 30002-30033+

**Maximum Scale (NX-OS Limits):**
- BGP EVPN neighbors: Thousands (spine limited by CPU)
- VXLANs: 16,000 VNIs per switch
- MAC addresses: 128K per VLAN
- ARP entries: 128K total

### Traffic Patterns

**East-West (Cross-Rack):**
- Routed via spine layer
- VXLAN encapsulation
- ECMP load balancing

**North-South (External):**
- Via border leafs (BL1a/BL1b) in rack 6A8
- VRF route leaking or external router

**Same-Rack:**
- Bridged via vPC peer-link (Po500)
- No spine involvement
- Line-rate performance

### Monitoring and Troubleshooting

**Key Show Commands:**

```bash
# OSPF validation
show ip ospf neighbors
show ip route 192.168.1.17  # Check ECMP paths

# BGP EVPN validation
show bgp l2vpn evpn summary
show nve peers
show l2route evpn mac all

# vPC validation
show vpc brief
show vpc consistency-parameters global

# Traffic validation
show interface Ethernet1/29 | include "30 seconds.*rate"
show interface port-channel13 counters

# QoS validation
show queuing pfc-queue interface Ethernet1/29
show interface Ethernet1/29 priority-flow-control
```

**Common Issues:**

1. **OSPF not FULL:** Check IP addressing, authentication, MTU
2. **BGP down:** Check loopback0 reachability, underlay routing
3. **VXLAN not forwarding:** Check NVE interface, VNI configuration
4. **vPC inconsistent:** Check `show vpc consistency-parameters`
5. **PFC storms:** Check watchdog, queue thresholds

---

## Known Issues and Resolutions

### Issue #1: OSPF Adjacency Failure (Resolved 2025-10-31)

**Symptom:**
- Cross-rack throughput limited to 325 Gbps (expected 395 Gbps)
- OSPF neighbors stuck in EXSTART state on cross-connections
- Traffic using only single spine path per leaf (no ECMP)

**Root Cause:**
- IP address misconfiguration on two spine interfaces
- SS1 Eth1/4 configured as .44 (should be .42)
- SS2 Eth1/3 configured as .42 (should be .44)
- Interfaces on different /31 subnets could not communicate

**Resolution:**
```bash
# On SS1:
interface Ethernet1/4
  ip address 192.168.3.42/31

# On SS2:
interface Ethernet1/3
  ip address 192.168.3.44/31
```

**Impact:**
- Issue present for 5-24 weeks but masked by 100G server bonds
- Only exposed after upgrading servers to 200G bonds
- After fix: All OSPF adjacencies FULL, ECMP working, performance restored to 395 Gbps

**Prevention:**
- Validate all OSPF adjacencies reach FULL state during deployment
- Verify ECMP route counts match expected topology
- Run cross-rack performance tests during commissioning
- Monitor OSPF neighbor states for non-FULL adjacencies

**Documentation:**
- Full analysis available in `/opt/git/ansible-cisco/performance-investigation/EXECUTIVE_SUMMARY.md`

---

---

## References

- Cisco VXLAN/EVPN Configuration Guide (NX-OS 10.5)
- Cisco Validated Design (CVD) for AI/ML Networking
- RFC 7348 - Virtual eXtensible Local Area Network (VXLAN)
- RFC 8365 - BGP EVPN
- RFC 3021 - Using 31-bit Prefixes on IPv4 Point-to-Point Links
