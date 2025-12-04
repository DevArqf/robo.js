# CLI Performance Baseline

## Environment
- **Node.js:** v24.7.0
- **OS:** darwin 25.1.0
- **CPU:** Apple M4
- **RAM:** 16 GB
- **Date:** 2025-12-04

## Test Configuration
- **Fixture:** build-test-project
- **Iterations:** 10 per command

## Results

### build

| Metric | Min | Max | Avg | StdDev |
|--------|-----|-----|-----|--------|
| Total Time (ms) | 314 | 563 | 369 | 80 |
| Import Phase (ms) | 7 | 18 | 10 | 3 |
| Peak Heap (MB) | 102.4 | 107.9 | 106.0 | 1.0 |
| CPU User (ms) | 552 | 756 | 586 | 57 |

### build --dev

| Metric | Min | Max | Avg | StdDev |
|--------|-----|-----|-----|--------|
| Total Time (ms) | 318 | 475 | 342 | 46 |
| Import Phase (ms) | 8 | 9 | 8 | 0 |
| Peak Heap (MB) | 106.2 | 107.3 | 106.0 | 0.0 |
| CPU User (ms) | 554 | 753 | 585 | 57 |

### start

| Metric | Min | Max | Avg | StdDev |
|--------|-----|-----|-----|--------|
| Total Time (ms) | 1308 | 1437 | 1329 | 38 |
| Import Phase (ms) | 6 | 9 | 8 | 1 |
| Peak Heap (MB) | 124.8 | 125.7 | 125.0 | 0.0 |
| CPU User (ms) | 725 | 924 | 788 | 70 |

## Raw Data

<details>
<summary>Click to expand raw iteration data</summary>

```json
[
  {
    "command": "build",
    "iterations": [
      {
        "command": "build",
        "timestamp": "2025-12-04T04:52:28.829Z",
        "phases": {
          "Config Loading": {
            "duration": 339,
            "heapDelta": 75513392,
            "heapPeak": 111316552
          },
          "Compilation": {
            "duration": 15,
            "heapDelta": 729032,
            "heapPeak": 112100976
          },
          "Route Discovery": {
            "duration": 0,
            "heapDelta": 15896,
            "heapPeak": 112117944
          },
          "Manifest Generation": {
            "duration": 3,
            "heapDelta": -54160,
            "heapPeak": 112569304
          },
          "Type Generation": {
            "duration": 1,
            "heapDelta": 74640,
            "heapPeak": 112645072
          },
          "imports": {
            "duration": 8,
            "heapDelta": 1636328,
            "heapPeak": 5430312
          }
        },
        "totals": {
          "duration": 563,
          "peakHeap": 113150240,
          "cpuUser": 574741,
          "cpuSystem": 78278
        }
      },
      {
        "command": "build",
        "timestamp": "2025-12-04T04:52:29.896Z",
        "phases": {
          "Config Loading": {
            "duration": 224,
            "heapDelta": 69887840,
            "heapPeak": 105578680
          },
          "Compilation": {
            "duration": 4,
            "heapDelta": 730704,
            "heapPeak": 106364176
          },
          "Route Discovery": {
            "duration": 0,
            "heapDelta": 15896,
            "heapPeak": 106381144
          },
          "Manifest Generation": {
            "duration": 3,
            "heapDelta": -20168,
            "heapPeak": 106834592
          },
          "Type Generation": {
            "duration": 1,
            "heapDelta": 74608,
            "heapPeak": 106910328
          },
          "imports": {
            "duration": 12,
            "heapDelta": 1643960,
            "heapPeak": 5437872
          }
        },
        "totals": {
          "duration": 478,
          "peakHeap": 107415632,
          "cpuUser": 755506,
          "cpuSystem": 80496
        }
      },
      {
        "command": "build",
        "timestamp": "2025-12-04T04:52:30.777Z",
        "phases": {
          "Config Loading": {
            "duration": 159,
            "heapDelta": 74170816,
            "heapPeak": 109979152
          },
          "Compilation": {
            "duration": 3,
            "heapDelta": 729768,
            "heapPeak": 110764312
          },
          "Route Discovery": {
            "duration": 0,
            "heapDelta": 15896,
            "heapPeak": 110781280
          },
          "Manifest Generation": {
            "duration": 3,
            "heapDelta": -16752,
            "heapPeak": 111232296
          },
          "Type Generation": {
            "duration": 1,
            "heapDelta": 74648,
            "heapPeak": 111308072
          },
          "imports": {
            "duration": 7,
            "heapDelta": 1640968,
            "heapPeak": 5434880
          }
        },
        "totals": {
          "duration": 314,
          "peakHeap": 111813192,
          "cpuUser": 554894,
          "cpuSystem": 52058
        }
      },
      {
        "command": "build",
        "timestamp": "2025-12-04T04:52:31.692Z",
        "phases": {
          "Config Loading": {
            "duration": 164,
            "heapDelta": 74047592,
            "heapPeak": 109848528
          },
          "Compilation": {
            "duration": 5,
            "heapDelta": 729120,
            "heapPeak": 110633048
          },
          "Route Discovery": {
            "duration": 0,
            "heapDelta": 15896,
            "heapPeak": 110650016
          },
          "Manifest Generation": {
            "duration": 4,
            "heapDelta": -191312,
            "heapPeak": 111101280
          },
          "Type Generation": {
            "duration": 1,
            "heapDelta": 74640,
            "heapPeak": 111177048
          },
          "imports": {
            "duration": 8,
            "heapDelta": 1635768,
            "heapPeak": 5429680
          }
        },
        "totals": {
          "duration": 327,
          "peakHeap": 111682192,
          "cpuUser": 566792,
          "cpuSystem": 56653
        }
      },
      {
        "command": "build",
        "timestamp": "2025-12-04T04:52:32.597Z",
        "phases": {
          "Config Loading": {
            "duration": 163,
            "heapDelta": 74751016,
            "heapPeak": 110509880
          },
          "Compilation": {
            "duration": 3,
            "heapDelta": 728856,
            "heapPeak": 111294128
          },
          "Route Discovery": {
            "duration": 0,
            "heapDelta": 15896,
            "heapPeak": 111311096
          },
          "Manifest Generation": {
            "duration": 3,
            "heapDelta": -163912,
            "heapPeak": 111763752
          },
          "Type Generation": {
            "duration": 1,
            "heapDelta": 74640,
            "heapPeak": 111839520
          },
          "imports": {
            "duration": 8,
            "heapDelta": 1651632,
            "heapPeak": 5445544
          }
        },
        "totals": {
          "duration": 324,
          "peakHeap": 112344608,
          "cpuUser": 564325,
          "cpuSystem": 54489
        }
      },
      {
        "command": "build",
        "timestamp": "2025-12-04T04:52:33.505Z",
        "phases": {
          "Config Loading": {
            "duration": 161,
            "heapDelta": 74381040,
            "heapPeak": 110190984
          },
          "Compilation": {
            "duration": 3,
            "heapDelta": 729256,
            "heapPeak": 110975632
          },
          "Route Discovery": {
            "duration": 0,
            "heapDelta": 15896,
            "heapPeak": 110992600
          },
          "Manifest Generation": {
            "duration": 3,
            "heapDelta": 52320,
            "heapPeak": 111444024
          },
          "Type Generation": {
            "duration": 0,
            "heapDelta": 74656,
            "heapPeak": 111519824
          },
          "imports": {
            "duration": 8,
            "heapDelta": 1633048,
            "heapPeak": 5426960
          }
        },
        "totals": {
          "duration": 322,
          "peakHeap": 112024928,
          "cpuUser": 568825,
          "cpuSystem": 55049
        }
      },
      {
        "command": "build",
        "timestamp": "2025-12-04T04:52:34.471Z",
        "phases": {
          "Config Loading": {
            "duration": 185,
            "heapDelta": 73838816,
            "heapPeak": 109750136
          },
          "Compilation": {
            "duration": 13,
            "heapDelta": 728344,
            "heapPeak": 110533872
          },
          "Route Discovery": {
            "duration": 0,
            "heapDelta": 15896,
            "heapPeak": 110550840
          },
          "Manifest Generation": {
            "duration": 12,
            "heapDelta": -30200,
            "heapPeak": 111001928
          },
          "Type Generation": {
            "duration": 2,
            "heapDelta": 74640,
            "heapPeak": 111077696
          },
          "imports": {
            "duration": 9,
            "heapDelta": 1651208,
            "heapPeak": 5445192
          }
        },
        "totals": {
          "duration": 372,
          "peakHeap": 111582824,
          "cpuUser": 578196,
          "cpuSystem": 79973
        }
      },
      {
        "command": "build",
        "timestamp": "2025-12-04T04:52:35.380Z",
        "phases": {
          "Config Loading": {
            "duration": 159,
            "heapDelta": 74299480,
            "heapPeak": 110058648
          },
          "Compilation": {
            "duration": 4,
            "heapDelta": 729128,
            "heapPeak": 110843168
          },
          "Route Discovery": {
            "duration": 0,
            "heapDelta": 15896,
            "heapPeak": 110860136
          },
          "Manifest Generation": {
            "duration": 3,
            "heapDelta": 114472,
            "heapPeak": 111312744
          },
          "Type Generation": {
            "duration": 1,
            "heapDelta": 74656,
            "heapPeak": 111388544
          },
          "imports": {
            "duration": 8,
            "heapDelta": 1640968,
            "heapPeak": 5434880
          }
        },
        "totals": {
          "duration": 320,
          "peakHeap": 111893648,
          "cpuUser": 552395,
          "cpuSystem": 52008
        }
      },
      {
        "command": "build",
        "timestamp": "2025-12-04T04:52:36.312Z",
        "phases": {
          "Config Loading": {
            "duration": 161,
            "heapDelta": 74211040,
            "heapPeak": 109968896
          },
          "Compilation": {
            "duration": 4,
            "heapDelta": 729496,
            "heapPeak": 110753904
          },
          "Route Discovery": {
            "duration": 0,
            "heapDelta": 15896,
            "heapPeak": 110770872
          },
          "Manifest Generation": {
            "duration": 3,
            "heapDelta": 181856,
            "heapPeak": 111223440
          },
          "Type Generation": {
            "duration": 0,
            "heapDelta": 74656,
            "heapPeak": 111299240
          },
          "imports": {
            "duration": 18,
            "heapDelta": 1613536,
            "heapPeak": 5407448
          }
        },
        "totals": {
          "duration": 338,
          "peakHeap": 111804432,
          "cpuUser": 563635,
          "cpuSystem": 55105
        }
      },
      {
        "command": "build",
        "timestamp": "2025-12-04T04:52:37.229Z",
        "phases": {
          "Config Loading": {
            "duration": 163,
            "heapDelta": 74386528,
            "heapPeak": 110193344
          },
          "Compilation": {
            "duration": 4,
            "heapDelta": 729296,
            "heapPeak": 110978040
          },
          "Route Discovery": {
            "duration": 0,
            "heapDelta": 15896,
            "heapPeak": 110995008
          },
          "Manifest Generation": {
            "duration": 3,
            "heapDelta": 54680,
            "heapPeak": 111446200
          },
          "Type Generation": {
            "duration": 1,
            "heapDelta": 74656,
            "heapPeak": 111522000
          },
          "imports": {
            "duration": 9,
            "heapDelta": 1638120,
            "heapPeak": 5432032
          }
        },
        "totals": {
          "duration": 327,
          "peakHeap": 112027112,
          "cpuUser": 578475,
          "cpuSystem": 54993
        }
      }
    ],
    "stats": {
      "duration": {
        "min": 314,
        "max": 563,
        "avg": 369,
        "stdDev": 80
      },
      "importPhase": {
        "min": 7,
        "max": 18,
        "avg": 10,
        "stdDev": 3
      },
      "peakHeap": {
        "min": 102.43952941894531,
        "max": 107.90847778320312,
        "avg": 106,
        "stdDev": 1
      },
      "cpuUser": {
        "min": 552.395,
        "max": 755.506,
        "avg": 586,
        "stdDev": 57
      }
    }
  },
  {
    "command": "build --dev",
    "iterations": [
      {
        "command": "build",
        "timestamp": "2025-12-04T04:52:38.176Z",
        "phases": {
          "Config Loading": {
            "duration": 171,
            "heapDelta": 74400064,
            "heapPeak": 110205792
          },
          "Compilation": {
            "duration": 22,
            "heapDelta": 735528,
            "heapPeak": 110998472
          },
          "Route Discovery": {
            "duration": 0,
            "heapDelta": 15896,
            "heapPeak": 111015464
          },
          "Manifest Generation": {
            "duration": 17,
            "heapDelta": 358288,
            "heapPeak": 111461968
          },
          "Type Generation": {
            "duration": 1,
            "heapDelta": 74656,
            "heapPeak": 111537768
          },
          "imports": {
            "duration": 8,
            "heapDelta": 1640912,
            "heapPeak": 5434880
          }
        },
        "totals": {
          "duration": 364,
          "peakHeap": 111543272,
          "cpuUser": 570568,
          "cpuSystem": 53911
        }
      },
      {
        "command": "build",
        "timestamp": "2025-12-04T04:52:39.079Z",
        "phases": {
          "Config Loading": {
            "duration": 161,
            "heapDelta": 74408968,
            "heapPeak": 110161200
          },
          "Compilation": {
            "duration": 3,
            "heapDelta": 735768,
            "heapPeak": 110954096
          },
          "Route Discovery": {
            "duration": 0,
            "heapDelta": 15896,
            "heapPeak": 110971064
          },
          "Manifest Generation": {
            "duration": 3,
            "heapDelta": 358872,
            "heapPeak": 111418152
          },
          "Type Generation": {
            "duration": 1,
            "heapDelta": 74672,
            "heapPeak": 111493968
          },
          "imports": {
            "duration": 8,
            "heapDelta": 1644408,
            "heapPeak": 5438376
          }
        },
        "totals": {
          "duration": 320,
          "peakHeap": 111499472,
          "cpuUser": 557620,
          "cpuSystem": 52836
        }
      },
      {
        "command": "build",
        "timestamp": "2025-12-04T04:52:39.979Z",
        "phases": {
          "Config Loading": {
            "duration": 162,
            "heapDelta": 74094552,
            "heapPeak": 110002416
          },
          "Compilation": {
            "duration": 4,
            "heapDelta": 735096,
            "heapPeak": 110794640
          },
          "Route Discovery": {
            "duration": 0,
            "heapDelta": 15896,
            "heapPeak": 110811608
          },
          "Manifest Generation": {
            "duration": 3,
            "heapDelta": 358200,
            "heapPeak": 111258032
          },
          "Type Generation": {
            "duration": 1,
            "heapDelta": 74664,
            "heapPeak": 111333840
          },
          "imports": {
            "duration": 9,
            "heapDelta": 1645936,
            "heapPeak": 5439904
          }
        },
        "totals": {
          "duration": 334,
          "peakHeap": 111339344,
          "cpuUser": 575893,
          "cpuSystem": 54901
        }
      },
      {
        "command": "build",
        "timestamp": "2025-12-04T04:52:40.896Z",
        "phases": {
          "Config Loading": {
            "duration": 161,
            "heapDelta": 74238984,
            "heapPeak": 110045504
          },
          "Compilation": {
            "duration": 5,
            "heapDelta": 735728,
            "heapPeak": 110838384
          },
          "Route Discovery": {
            "duration": 0,
            "heapDelta": 15896,
            "heapPeak": 110855352
          },
          "Manifest Generation": {
            "duration": 3,
            "heapDelta": 358064,
            "heapPeak": 111301632
          },
          "Type Generation": {
            "duration": 1,
            "heapDelta": 74896,
            "heapPeak": 111377672
          },
          "imports": {
            "duration": 9,
            "heapDelta": 1642976,
            "heapPeak": 5436944
          }
        },
        "totals": {
          "duration": 322,
          "peakHeap": 111383176,
          "cpuUser": 566727,
          "cpuSystem": 51942
        }
      },
      {
        "command": "build",
        "timestamp": "2025-12-04T04:52:41.814Z",
        "phases": {
          "Config Loading": {
            "duration": 160,
            "heapDelta": 74285632,
            "heapPeak": 110087368
          },
          "Compilation": {
            "duration": 3,
            "heapDelta": 735488,
            "heapPeak": 110879984
          },
          "Route Discovery": {
            "duration": 0,
            "heapDelta": 15896,
            "heapPeak": 110896952
          },
          "Manifest Generation": {
            "duration": 3,
            "heapDelta": 359632,
            "heapPeak": 111344800
          },
          "Type Generation": {
            "duration": 1,
            "heapDelta": 74656,
            "heapPeak": 111420600
          },
          "imports": {
            "duration": 8,
            "heapDelta": 1635712,
            "heapPeak": 5429752
          }
        },
        "totals": {
          "duration": 324,
          "peakHeap": 111426104,
          "cpuUser": 570684,
          "cpuSystem": 50531
        }
      },
      {
        "command": "build",
        "timestamp": "2025-12-04T04:52:42.707Z",
        "phases": {
          "Config Loading": {
            "duration": 162,
            "heapDelta": 74299088,
            "heapPeak": 110054840
          },
          "Compilation": {
            "duration": 3,
            "heapDelta": 735512,
            "heapPeak": 110847480
          },
          "Route Discovery": {
            "duration": 0,
            "heapDelta": 15896,
            "heapPeak": 110864448
          },
          "Manifest Generation": {
            "duration": 3,
            "heapDelta": 359768,
            "heapPeak": 111312440
          },
          "Type Generation": {
            "duration": 0,
            "heapDelta": 74656,
            "heapPeak": 111388240
          },
          "imports": {
            "duration": 8,
            "heapDelta": 1649832,
            "heapPeak": 5443800
          }
        },
        "totals": {
          "duration": 318,
          "peakHeap": 111393744,
          "cpuUser": 554197,
          "cpuSystem": 51086
        }
      },
      {
        "command": "build",
        "timestamp": "2025-12-04T04:52:43.614Z",
        "phases": {
          "Config Loading": {
            "duration": 159,
            "heapDelta": 74447168,
            "heapPeak": 110250192
          },
          "Compilation": {
            "duration": 3,
            "heapDelta": 735984,
            "heapPeak": 111043304
          },
          "Route Discovery": {
            "duration": 0,
            "heapDelta": 15896,
            "heapPeak": 111060272
          },
          "Manifest Generation": {
            "duration": 3,
            "heapDelta": 358144,
            "heapPeak": 111506648
          },
          "Type Generation": {
            "duration": 1,
            "heapDelta": 74656,
            "heapPeak": 111582448
          },
          "imports": {
            "duration": 8,
            "heapDelta": 1642976,
            "heapPeak": 5436944
          }
        },
        "totals": {
          "duration": 318,
          "peakHeap": 111587952,
          "cpuUser": 563660,
          "cpuSystem": 53415
        }
      },
      {
        "command": "build",
        "timestamp": "2025-12-04T04:52:44.679Z",
        "phases": {
          "Config Loading": {
            "duration": 290,
            "heapDelta": 75228800,
            "heapPeak": 111131920
          },
          "Compilation": {
            "duration": 16,
            "heapDelta": 734016,
            "heapPeak": 111923064
          },
          "Route Discovery": {
            "duration": 0,
            "heapDelta": 15896,
            "heapPeak": 111940032
          },
          "Manifest Generation": {
            "duration": 9,
            "heapDelta": 357864,
            "heapPeak": 112386112
          },
          "Type Generation": {
            "duration": 2,
            "heapDelta": 74896,
            "heapPeak": 112462152
          },
          "imports": {
            "duration": 8,
            "heapDelta": 1636136,
            "heapPeak": 5430104
          }
        },
        "totals": {
          "duration": 475,
          "peakHeap": 112467656,
          "cpuUser": 752701,
          "cpuSystem": 90491
        }
      },
      {
        "command": "build",
        "timestamp": "2025-12-04T04:52:45.594Z",
        "phases": {
          "Config Loading": {
            "duration": 160,
            "heapDelta": 74229400,
            "heapPeak": 109978472
          },
          "Compilation": {
            "duration": 4,
            "heapDelta": 735592,
            "heapPeak": 110771192
          },
          "Route Discovery": {
            "duration": 0,
            "heapDelta": 15896,
            "heapPeak": 110788160
          },
          "Manifest Generation": {
            "duration": 3,
            "heapDelta": 359504,
            "heapPeak": 111235904
          },
          "Type Generation": {
            "duration": 1,
            "heapDelta": 74896,
            "heapPeak": 111311944
          },
          "imports": {
            "duration": 9,
            "heapDelta": 1638200,
            "heapPeak": 5432168
          }
        },
        "totals": {
          "duration": 320,
          "peakHeap": 111317448,
          "cpuUser": 554152,
          "cpuSystem": 51638
        }
      },
      {
        "command": "build",
        "timestamp": "2025-12-04T04:52:46.517Z",
        "phases": {
          "Config Loading": {
            "duration": 163,
            "heapDelta": 74168544,
            "heapPeak": 109972280
          },
          "Compilation": {
            "duration": 3,
            "heapDelta": 735424,
            "heapPeak": 110764840
          },
          "Route Discovery": {
            "duration": 0,
            "heapDelta": 15896,
            "heapPeak": 110781808
          },
          "Manifest Generation": {
            "duration": 3,
            "heapDelta": 358840,
            "heapPeak": 111228864
          },
          "Type Generation": {
            "duration": 1,
            "heapDelta": 74656,
            "heapPeak": 111304664
          },
          "imports": {
            "duration": 8,
            "heapDelta": 1635712,
            "heapPeak": 5429680
          }
        },
        "totals": {
          "duration": 327,
          "peakHeap": 111310168,
          "cpuUser": 578849,
          "cpuSystem": 52014
        }
      }
    ],
    "stats": {
      "duration": {
        "min": 318,
        "max": 475,
        "avg": 342,
        "stdDev": 46
      },
      "importPhase": {
        "min": 8,
        "max": 9,
        "avg": 8,
        "stdDev": 0
      },
      "peakHeap": {
        "min": 106.15364837646484,
        "max": 107.25751495361328,
        "avg": 106,
        "stdDev": 0
      },
      "cpuUser": {
        "min": 554.152,
        "max": 752.701,
        "avg": 585,
        "stdDev": 57
      }
    }
  },
  {
    "command": "start",
    "iterations": [
      {
        "command": "start",
        "timestamp": "2025-12-04T04:52:48.775Z",
        "phases": {
          "Config Loading": {
            "duration": 156,
            "heapDelta": 64470280,
            "heapPeak": 100054216
          },
          "Robo Start": {
            "duration": 5,
            "heapDelta": 1441336,
            "heapPeak": 101604720
          },
          "imports": {
            "duration": 6,
            "heapDelta": 1652304,
            "heapPeak": 5446216
          }
        },
        "totals": {
          "duration": 1315,
          "peakHeap": 130974840,
          "cpuUser": 765756,
          "cpuSystem": 73715
        }
      },
      {
        "command": "start",
        "timestamp": "2025-12-04T04:52:50.823Z",
        "phases": {
          "Config Loading": {
            "duration": 186,
            "heapDelta": 65440592,
            "heapPeak": 100843544
          },
          "Robo Start": {
            "duration": 3,
            "heapDelta": 1119976,
            "heapPeak": 102513368
          },
          "imports": {
            "duration": 9,
            "heapDelta": 1643032,
            "heapPeak": 5436944
          }
        },
        "totals": {
          "duration": 1437,
          "peakHeap": 131777352,
          "cpuUser": 923678,
          "cpuSystem": 80698
        }
      },
      {
        "command": "start",
        "timestamp": "2025-12-04T04:52:52.730Z",
        "phases": {
          "Config Loading": {
            "duration": 151,
            "heapDelta": 65021496,
            "heapPeak": 100632024
          },
          "Robo Start": {
            "duration": 3,
            "heapDelta": 1171360,
            "heapPeak": 102060888
          },
          "imports": {
            "duration": 7,
            "heapDelta": 1636192,
            "heapPeak": 5430104
          }
        },
        "totals": {
          "duration": 1315,
          "peakHeap": 131747128,
          "cpuUser": 760705,
          "cpuSystem": 65817
        }
      },
      {
        "command": "start",
        "timestamp": "2025-12-04T04:52:54.648Z",
        "phases": {
          "Config Loading": {
            "duration": 153,
            "heapDelta": 64501704,
            "heapPeak": 100043880
          },
          "Robo Start": {
            "duration": 2,
            "heapDelta": 1072176,
            "heapPeak": 101524416
          },
          "imports": {
            "duration": 8,
            "heapDelta": 1635768,
            "heapPeak": 5429752
          }
        },
        "totals": {
          "duration": 1310,
          "peakHeap": 130857064,
          "cpuUser": 725416,
          "cpuSystem": 64147
        }
      },
      {
        "command": "start",
        "timestamp": "2025-12-04T04:52:56.573Z",
        "phases": {
          "Config Loading": {
            "duration": 154,
            "heapDelta": 64398104,
            "heapPeak": 99940232
          },
          "Robo Start": {
            "duration": 2,
            "heapDelta": 1613080,
            "heapPeak": 101662480
          },
          "imports": {
            "duration": 8,
            "heapDelta": 1643512,
            "heapPeak": 5437424
          }
        },
        "totals": {
          "duration": 1313,
          "peakHeap": 131270600,
          "cpuUser": 750865,
          "cpuSystem": 66469
        }
      },
      {
        "command": "start",
        "timestamp": "2025-12-04T04:52:58.485Z",
        "phases": {
          "Config Loading": {
            "duration": 153,
            "heapDelta": 64643696,
            "heapPeak": 100072360
          },
          "Robo Start": {
            "duration": 3,
            "heapDelta": 1223672,
            "heapPeak": 101405200
          },
          "imports": {
            "duration": 8,
            "heapDelta": 1641800,
            "heapPeak": 5435712
          }
        },
        "totals": {
          "duration": 1311,
          "peakHeap": 130932568,
          "cpuUser": 744551,
          "cpuSystem": 66352
        }
      },
      {
        "command": "start",
        "timestamp": "2025-12-04T04:53:00.443Z",
        "phases": {
          "Config Loading": {
            "duration": 175,
            "heapDelta": 64408568,
            "heapPeak": 99950808
          },
          "Robo Start": {
            "duration": 10,
            "heapDelta": 1412584,
            "heapPeak": 101625752
          },
          "imports": {
            "duration": 9,
            "heapDelta": 1632752,
            "heapPeak": 5426664
          }
        },
        "totals": {
          "duration": 1346,
          "peakHeap": 131024648,
          "cpuUser": 910448,
          "cpuSystem": 96938
        }
      },
      {
        "command": "start",
        "timestamp": "2025-12-04T04:53:02.359Z",
        "phases": {
          "Config Loading": {
            "duration": 154,
            "heapDelta": 64279392,
            "heapPeak": 99973880
          },
          "Robo Start": {
            "duration": 3,
            "heapDelta": 1161328,
            "heapPeak": 101288888
          },
          "imports": {
            "duration": 8,
            "heapDelta": 1651632,
            "heapPeak": 5445544
          }
        },
        "totals": {
          "duration": 1311,
          "peakHeap": 130947608,
          "cpuUser": 735459,
          "cpuSystem": 63293
        }
      },
      {
        "command": "start",
        "timestamp": "2025-12-04T04:53:04.288Z",
        "phases": {
          "Config Loading": {
            "duration": 156,
            "heapDelta": 64382608,
            "heapPeak": 99966792
          },
          "Robo Start": {
            "duration": 2,
            "heapDelta": 1388856,
            "heapPeak": 101509368
          },
          "imports": {
            "duration": 9,
            "heapDelta": 1640968,
            "heapPeak": 5434880
          }
        },
        "totals": {
          "duration": 1321,
          "peakHeap": 130902320,
          "cpuUser": 829658,
          "cpuSystem": 88663
        }
      },
      {
        "command": "start",
        "timestamp": "2025-12-04T04:53:06.183Z",
        "phases": {
          "Config Loading": {
            "duration": 151,
            "heapDelta": 64313344,
            "heapPeak": 99746176
          },
          "Robo Start": {
            "duration": 2,
            "heapDelta": 1161776,
            "heapPeak": 101151624
          },
          "imports": {
            "duration": 7,
            "heapDelta": 1636872,
            "heapPeak": 5430784
          }
        },
        "totals": {
          "duration": 1308,
          "peakHeap": 131221568,
          "cpuUser": 732096,
          "cpuSystem": 63581
        }
      }
    ],
    "stats": {
      "duration": {
        "min": 1308,
        "max": 1437,
        "avg": 1329,
        "stdDev": 38
      },
      "importPhase": {
        "min": 6,
        "max": 9,
        "avg": 8,
        "stdDev": 1
      },
      "peakHeap": {
        "min": 124.7950210571289,
        "max": 125.67267608642578,
        "avg": 125,
        "stdDev": 0
      },
      "cpuUser": {
        "min": 725.416,
        "max": 923.678,
        "avg": 788,
        "stdDev": 70
      }
    }
  }
]
```

</details>

---

*Generated by CLI Performance Benchmark Runner*
