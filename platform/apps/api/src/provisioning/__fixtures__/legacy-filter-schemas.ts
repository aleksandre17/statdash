// FROZEN PRE-P5 LEGACY FILTER SCHEMAS (the two-bar baseline) — see byte-identical fitness header.
export const LEGACY_FILTER_SCHEMAS = {
  "accounts": {
    "filterSchema": {
      "bars": {
        "range-bar": {
          "filters": {
            "account": {
              "default": "",
              "type": "hidden"
            },
            "fromYear": {
              "default": {
                "from": "options",
                "pick": "first"
              },
              "label": "შუალედი:",
              "options": {
                "items": {
                  "$d": "time"
                },
                "labelField": "code",
                "pipe": [
                  {
                    "by": "code",
                    "dir": "asc",
                    "op": "sort"
                  }
                ],
                "type": "inline",
                "valueField": "code"
              },
              "suffix": "-დან",
              "type": "select"
            },
            "measure": {
              "default": "",
              "type": "hidden"
            },
            "mode": {
              "default": "year",
              "type": "hidden"
            },
            "toYear": {
              "default": {
                "from": "options",
                "pick": "first"
              },
              "options": {
                "items": {
                  "$d": "time"
                },
                "labelField": "code",
                "pipe": [
                  {
                    "by": "code",
                    "dir": "desc",
                    "op": "sort"
                  }
                ],
                "type": "inline",
                "valueField": "code"
              },
              "suffix": "-მდე",
              "type": "select"
            }
          },
          "order": 0,
          "position": "sticky",
          "showWhen": {
            "mode": "range"
          }
        },
        "year-bar": {
          "filters": {
            "account": {
              "default": "",
              "emptyLabel": "ყველა",
              "label": "ანგარიში:",
              "options": {
                "items": {
                  "$d": "account"
                },
                "labelField": "label",
                "pipe": [
                  {
                    "by": "order",
                    "dir": "asc",
                    "op": "sort"
                  }
                ],
                "type": "inline",
                "valueField": "code"
              },
              "type": "select"
            },
            "measure": {
              "default": "",
              "type": "hidden"
            },
            "mode": {
              "default": "year",
              "type": "hidden"
            },
            "year": {
              "default": {
                "from": "options",
                "pick": "last"
              },
              "type": "year-select",
              "years": {
                "field": "code",
                "items": {
                  "$cl": "time"
                },
                "type": "inline"
              }
            }
          },
          "order": 0,
          "position": "sticky",
          "showWhen": {
            "mode": {
              "neq": "range"
            }
          }
        }
      },
      "context": {
        "dims": {
          "account": "account",
          "fromYear": "fromYear",
          "measure": "measure",
          "time": "year",
          "toYear": "toYear"
        },
        "timeMode": "mode"
      },
      "effects": [
        {
          "set": {
            "account": "",
            "measure": ""
          },
          "when": {
            "mode": "range"
          }
        },
        {
          "set": {
            "fromYear": "",
            "toYear": ""
          },
          "when": {
            "mode": {
              "neq": "range"
            }
          }
        }
      ]
    },
    "modeOrder": [
      "year",
      "range"
    ]
  },
  "gdp": {
    "filterSchema": {
      "bars": {
        "range-bar": {
          "filters": {
            "fromYear": {
              "default": {
                "from": "options",
                "pick": "first"
              },
              "label": "შუალედი:",
              "options": {
                "items": {
                  "$d": "time"
                },
                "labelField": "code",
                "pipe": [
                  {
                    "by": "code",
                    "dir": "asc",
                    "op": "sort"
                  }
                ],
                "type": "inline",
                "valueField": "code"
              },
              "suffix": "-დან",
              "type": "select"
            },
            "mode": {
              "default": "year",
              "type": "hidden"
            },
            "toYear": {
              "default": {
                "from": "options",
                "pick": "first"
              },
              "options": {
                "items": {
                  "$d": "time"
                },
                "labelField": "code",
                "pipe": [
                  {
                    "by": "code",
                    "dir": "desc",
                    "op": "sort"
                  }
                ],
                "type": "inline",
                "valueField": "code"
              },
              "suffix": "-მდე",
              "type": "select"
            }
          },
          "order": 0,
          "position": "sticky",
          "showWhen": {
            "mode": "range"
          }
        },
        "year-bar": {
          "filters": {
            "mode": {
              "default": "year",
              "type": "hidden"
            },
            "year": {
              "default": {
                "from": "options",
                "pick": "last"
              },
              "type": "year-select",
              "years": {
                "field": "code",
                "items": {
                  "$cl": "time"
                },
                "type": "inline"
              }
            }
          },
          "order": 0,
          "position": "sticky",
          "showWhen": {
            "mode": {
              "neq": "range"
            }
          }
        }
      },
      "context": {
        "dims": {
          "fromYear": "fromYear",
          "time": "year",
          "toYear": "toYear"
        },
        "timeMode": "mode"
      },
      "effects": [
        {
          "set": {
            "year": ""
          },
          "when": {
            "mode": "range"
          }
        },
        {
          "set": {
            "fromYear": "",
            "toYear": ""
          },
          "when": {
            "mode": {
              "neq": "range"
            }
          }
        }
      ]
    },
    "modeOrder": [
      "year",
      "range"
    ]
  },
  "regional": {
    "filterSchema": {
      "bars": {
        "range-bar": {
          "filters": {
            "fromYear": {
              "default": {
                "from": "options",
                "pick": "first"
              },
              "label": "შუალედი:",
              "options": {
                "items": {
                  "$d": "time"
                },
                "labelField": "code",
                "pipe": [
                  {
                    "by": "code",
                    "dir": "asc",
                    "op": "sort"
                  }
                ],
                "type": "inline",
                "valueField": "code"
              },
              "suffix": "-დან",
              "type": "select"
            },
            "mode": {
              "default": "year",
              "type": "hidden"
            },
            "region": {
              "default": "",
              "type": "hidden"
            },
            "sector": {
              "default": "_T",
              "type": "hidden"
            },
            "toYear": {
              "default": {
                "from": "options",
                "pick": "first"
              },
              "options": {
                "items": {
                  "$d": "time"
                },
                "labelField": "code",
                "pipe": [
                  {
                    "by": "code",
                    "dir": "desc",
                    "op": "sort"
                  }
                ],
                "type": "inline",
                "valueField": "code"
              },
              "suffix": "-მდე",
              "type": "select"
            }
          },
          "order": 0,
          "position": "sticky",
          "showWhen": {
            "mode": "range"
          }
        },
        "year-bar": {
          "filters": {
            "mode": {
              "default": "year",
              "type": "hidden"
            },
            "region": {
              "default": "",
              "type": "hidden"
            },
            "spanFrom": {
              "alwaysResolve": true,
              "default": {
                "from": "options",
                "pick": "first"
              },
              "options": {
                "items": {
                  "$d": "time"
                },
                "labelField": "code",
                "pipe": [
                  {
                    "by": "code",
                    "dir": "asc",
                    "op": "sort"
                  }
                ],
                "type": "inline",
                "valueField": "code"
              },
              "type": "hidden"
            },
            "spanTo": {
              "alwaysResolve": true,
              "default": {
                "from": "options",
                "pick": "first"
              },
              "options": {
                "items": {
                  "$d": "time"
                },
                "labelField": "code",
                "pipe": [
                  {
                    "by": "code",
                    "dir": "desc",
                    "op": "sort"
                  }
                ],
                "type": "inline",
                "valueField": "code"
              },
              "type": "hidden"
            },
            "sector": {
              "default": "_T",
              "emptyLabel": "ყველა",
              "label": "სექტორი:",
              "options": {
                "items": {
                  "$d": "sector"
                },
                "labelField": "label",
                "pipe": [
                  {
                    "op": "filter",
                    "where": {
                      "code": {
                        "$ne": "_T"
                      }
                    }
                  },
                  {
                    "by": "label",
                    "dir": "asc",
                    "op": "sort"
                  }
                ],
                "type": "inline",
                "valueField": "code"
              },
              "type": "select"
            },
            "year": {
              "default": {
                "from": "options",
                "pick": "last"
              },
              "type": "year-select",
              "years": {
                "field": "code",
                "items": {
                  "$cl": "time"
                },
                "type": "inline"
              }
            }
          },
          "order": 0,
          "position": "sticky",
          "showWhen": {
            "mode": {
              "neq": "range"
            }
          }
        }
      },
      "context": {
        "dims": {
          "fromYear": "fromYear",
          "geo": "region",
          "geos": "geos",
          "sector": "sector",
          "spanFrom": "spanFrom",
          "spanTo": "spanTo",
          "time": "year",
          "toYear": "toYear"
        },
        "timeMode": "mode"
      },
      "effects": [
        {
          "set": {
            "sector": "_T",
            "year": ""
          },
          "when": {
            "mode": "range"
          }
        },
        {
          "set": {
            "fromYear": "",
            "toYear": ""
          },
          "when": {
            "mode": {
              "neq": "range"
            }
          }
        }
      ]
    },
    "modeOrder": [
      "year",
      "range"
    ]
  }
} as const
