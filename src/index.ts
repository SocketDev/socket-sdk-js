import Oas from 'oas';
import APICore from 'api/dist/core';
import definition from './openapi.json';

class SDK {
  spec: Oas;
  core: APICore;
  authKeys: (number | string)[][] = [];

  constructor() {
    this.spec = Oas.init(definition);
    this.core = new APICore(this.spec, 'socket-sdk/0.0.1 (api/5.0.0-beta.3)');
  }

  /**
   * Optionally configure various options, such as response parsing, that the SDK allows.
   *
   * @param config Object of supported SDK options and toggles.
   * @param config.parseResponse If responses are parsed according to its `Content-Type` header.
   */
  config(config: ConfigOptions) {
    this.core.setConfig(config);
  }

  /**
   * If the API you're using requires authentication you can supply the required credentials
   * through this method and the library will magically determine how they should be used
   * within your API request.
   *
   * With the exception of OpenID and MutualTLS, it supports all forms of authentication
   * supported by the OpenAPI specification.
   *
   * @example <caption>HTTP Basic auth</caption>
   * sdk.auth('username', 'password');
   *
   * @example <caption>Bearer tokens (HTTP or OAuth 2)</caption>
   * sdk.auth('myBearerToken');
   *
   * @example <caption>API Keys</caption>
   * sdk.auth('myApiKey');
   *
   * @see {@link https://spec.openapis.org/oas/v3.0.3#fixed-fields-22}
   * @see {@link https://spec.openapis.org/oas/v3.1.0#fixed-fields-22}
   * @param values Your auth credentials for the API; can specify up to two strings or numbers.
   */
  auth(...values: string[] | number[]) {
    this.core.setAuth(...values);
    return this;
  }

  /**
   * If the API you're using offers alternate server URLs, and server variables, you can tell
   * the SDK which one to use with this method. To use it you can supply either one of the
   * server URLs that are contained within the OpenAPI definition (along with any server
   * variables), or you can pass it a fully qualified URL to use (that may or may not exist
   * within the OpenAPI definition).
   *
   * @example <caption>Server URL with server variables</caption>
   * sdk.server('https://{region}.api.example.com/{basePath}', {
   *   name: 'eu',
   *   basePath: 'v14',
   * });
   *
   * @example <caption>Fully qualified server URL</caption>
   * sdk.server('https://eu.api.example.com/v14');
   *
   * @param url Server URL
   * @param variables An object of variables to replace into the server URL.
   */
  server(url: string, variables = {}) {
    this.core.setServer(url, variables);
  }

  /**
   * Get all the issues related with a particular npm package version.
   * This endpoint returns the issue type, location, and additional details related to each issue in the `props` attribute.
   *
   * You can [see here](https://socket.dev/npm/issue) the full list of issues.
   *
   * @summary Get issues by package
   */
  get(
    path: '/npm/{package}/{version}/issues',
    metadata: GetIssuesByNPMPackageMetadataParam
  ): Promise<
    | GetIssuesByNPMPackage_Response_200
    | GetIssuesByNPMPackage_Response_400
    | GetIssuesByNPMPackage_Response_401
    | GetIssuesByNPMPackage_Response_403
    | GetIssuesByNPMPackage_Response_404
    | GetIssuesByNPMPackage_Response_429
  >;
  /**
   * Get all the scores and metrics by category that are used to evaluate the package version.
   *
   * @summary Get score by package
   */
  get(
    path: '/npm/{package}/{version}/score',
    metadata: GetScoreByNPMPackageMetadataParam
  ): Promise<
    | GetScoreByNPMPackage_Response_200
    | GetScoreByNPMPackage_Response_400
    | GetScoreByNPMPackage_Response_401
    | GetScoreByNPMPackage_Response_403
    | GetScoreByNPMPackage_Response_404
    | GetScoreByNPMPackage_Response_429
  >;
  /**
   * Get all your project reports.
   *
   * @summary Get list of reports
   */
  get(
    path: '/report/list'
  ): Promise<
    | GetReportList_Response_200
    | GetReportList_Response_400
    | GetReportList_Response_401
    | GetReportList_Response_403
    | GetReportList_Response_404
    | GetReportList_Response_429
  >;
  /**
   * Get all the issues, packages, and scores related to an specific project report.
   *
   * @summary View a report
   */
  get(
    path: '/report/view/{id}',
    metadata: GetReportMetadataParam
  ): Promise<
    | GetReport_Response_200
    | GetReport_Response_400
    | GetReport_Response_401
    | GetReport_Response_403
    | GetReport_Response_404
    | GetReport_Response_429
  >;
  /**
   * Retrieve the API specification in an Openapi JSON format.
   *
   * @summary Returns the OpenAPI definition
   */
  get(path: '/openapi'): Promise<GetOpenAPI_Response_200 | GetOpenAPI_Response_429>;
  /**
   * Get your current API quota. You can use this endpoint to prevent doing requests that might spend all your quota.
   *
   * @summary Get quota
   */
  get(path: '/quota'): Promise<GetQuota_Response_200 | GetQuota_Response_401 | GetQuota_Response_429>;
  /**
   * Access any GET endpoint on your API.
   *
   * @param path API path to make a request against.
   * @param metadata Object containing all path, query, header, and cookie parameters to supply.
   */
  get<T = unknown>(path: string, metadata?: Record<string, unknown>): Promise<T> {
    return this.core.fetch(path, 'get', metadata);
  }

  /**
   * Upload a lockfile to get your project analyzed by Socket.
   * You can upload multiple lockfiles in the same request, but each filename must be unique.
   * The name of the file must be in the supported list.
   *
   * The supported lockfiles (and filenames) are: `package.json` and `package-lock.json`.
   *
   * For example, these are valid filenames: `package.json`, `folder/package.json` and `deep/nested/folder/package.json`.
   *
   * @summary Create a report
   */
  put(
    path: '/report/upload',
    body?: CreateReportBodyParam
  ): Promise<
    | CreateReport_Response_200
    | CreateReport_Response_400
    | CreateReport_Response_401
    | CreateReport_Response_403
    | CreateReport_Response_404
    | CreateReport_Response_429
  >;
  /**
   * Access any PUT endpoint on your API.
   *
   * @param path API path to make a request against.
   * @param body Request body payload data.
   * @param metadata Object containing all path, query, header, and cookie parameters to supply.
   */
  put<T = unknown>(path: string, body?: unknown, metadata?: Record<string, unknown>): Promise<T> {
    return this.core.fetch(path, 'put', body, metadata);
  }

  /**
   * Get all the issues related with a particular npm package version.
   * This endpoint returns the issue type, location, and additional details related to each issue in the `props` attribute.
   *
   * You can [see here](https://socket.dev/npm/issue) the full list of issues.
   *
   * @summary Get issues by package
   */
  getIssuesByNPMPackage(
    metadata: GetIssuesByNPMPackageMetadataParam
  ): Promise<
    | GetIssuesByNPMPackage_Response_200
    | GetIssuesByNPMPackage_Response_400
    | GetIssuesByNPMPackage_Response_401
    | GetIssuesByNPMPackage_Response_403
    | GetIssuesByNPMPackage_Response_404
    | GetIssuesByNPMPackage_Response_429
  > {
    return this.core.fetch('/npm/{package}/{version}/issues', 'get', metadata);
  }

  /**
   * Get all the scores and metrics by category that are used to evaluate the package version.
   *
   * @summary Get score by package
   */
  getScoreByNPMPackage(
    metadata: GetScoreByNPMPackageMetadataParam
  ): Promise<
    | GetScoreByNPMPackage_Response_200
    | GetScoreByNPMPackage_Response_400
    | GetScoreByNPMPackage_Response_401
    | GetScoreByNPMPackage_Response_403
    | GetScoreByNPMPackage_Response_404
    | GetScoreByNPMPackage_Response_429
  > {
    return this.core.fetch('/npm/{package}/{version}/score', 'get', metadata);
  }

  /**
   * Get all your project reports.
   *
   * @summary Get list of reports
   */
  getReportList(): Promise<
    | GetReportList_Response_200
    | GetReportList_Response_400
    | GetReportList_Response_401
    | GetReportList_Response_403
    | GetReportList_Response_404
    | GetReportList_Response_429
  > {
    return this.core.fetch('/report/list', 'get');
  }

  /**
   * Upload a lockfile to get your project analyzed by Socket.
   * You can upload multiple lockfiles in the same request, but each filename must be unique.
   * The name of the file must be in the supported list.
   *
   * The supported lockfiles (and filenames) are: `package.json` and `package-lock.json`.
   *
   * For example, these are valid filenames: `package.json`, `folder/package.json` and `deep/nested/folder/package.json`.
   *
   * @summary Create a report
   */
  createReport(
    body?: CreateReportBodyParam
  ): Promise<
    | CreateReport_Response_200
    | CreateReport_Response_400
    | CreateReport_Response_401
    | CreateReport_Response_403
    | CreateReport_Response_404
    | CreateReport_Response_429
  > {
    return this.core.fetch('/report/upload', 'put', body);
  }

  /**
   * Get all the issues, packages, and scores related to an specific project report.
   *
   * @summary View a report
   */
  getReport(
    metadata: GetReportMetadataParam
  ): Promise<
    | GetReport_Response_200
    | GetReport_Response_400
    | GetReport_Response_401
    | GetReport_Response_403
    | GetReport_Response_404
    | GetReport_Response_429
  > {
    return this.core.fetch('/report/view/{id}', 'get', metadata);
  }

  /**
   * Retrieve the API specification in an Openapi JSON format.
   *
   * @summary Returns the OpenAPI definition
   */
  getOpenAPI(): Promise<GetOpenAPI_Response_200 | GetOpenAPI_Response_429> {
    return this.core.fetch('/openapi', 'get');
  }

  /**
   * Get your current API quota. You can use this endpoint to prevent doing requests that might spend all your quota.
   *
   * @summary Get quota
   */
  getQuota(): Promise<GetQuota_Response_200 | GetQuota_Response_401 | GetQuota_Response_429> {
    return this.core.fetch('/quota', 'get');
  }
}

const createSDK = (() => {
  return new SDK();
})();
export default createSDK;

interface ConfigOptions {
  /**
   * By default we parse the response based on the `Content-Type` header of the request. You
   * can disable this functionality by negating this option.
   */
  parseResponse: boolean;
}
type GetIssuesByNPMPackageMetadataParam = {
  package: string;
  version: string;
  [k: string]: unknown;
};
type GetIssuesByNPMPackage_Response_200 = (
  | {
      /**
       * `criticalCVE`
       */
      type?: 'criticalCVE';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          id: number;
          title: string;
          severity: string;
          url: string;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `cve`
       */
      type?: 'cve';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          id: number;
          title: string;
          severity: string;
          url: string;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `mildCVE`
       */
      type?: 'mildCVE';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          id: number;
          title: string;
          severity: string;
          url: string;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `installScripts`
       */
      type?: 'installScripts';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          script: string;
          source: string;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `hasNativeCode`
       */
      type?: 'hasNativeCode';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {};
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `binScriptConfusion`
       */
      type?: 'binScriptConfusion';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          binScript: string;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `shellScriptOverride`
       */
      type?: 'shellScriptOverride';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          binScript: string;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `filesystemAccess`
       */
      type?: 'filesystemAccess';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          module: string;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `networkAccess`
       */
      type?: 'networkAccess';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          module: string;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `shellAccess`
       */
      type?: 'shellAccess';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          module: string;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `debugAccess`
       */
      type?: 'debugAccess';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          module: string;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `longStrings`
       */
      type?: 'longStrings';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {};
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `highEntropyStrings`
       */
      type?: 'highEntropyStrings';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {};
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `urlStrings`
       */
      type?: 'urlStrings';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          urlFragment: string;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `usesEval`
       */
      type?: 'usesEval';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          evalType: string;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `dynamicRequire`
       */
      type?: 'dynamicRequire';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {};
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `envVars`
       */
      type?: 'envVars';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          envVars: string;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `missingDependency`
       */
      type?: 'missingDependency';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          name: string;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `unusedDependency`
       */
      type?: 'unusedDependency';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          name: string;
          version: string;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `peerDependency`
       */
      type?: 'peerDependency';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          name: string;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `uncaughtOptionalDependency`
       */
      type?: 'uncaughtOptionalDependency';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          name: string;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `unresolvedRequire`
       */
      type?: 'unresolvedRequire';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {};
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `extraneousDependency`
       */
      type?: 'extraneousDependency';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {};
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `obfuscatedRequire`
       */
      type?: 'obfuscatedRequire';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {};
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `obfuscatedFile`
       */
      type?: 'obfuscatedFile';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          confidence: number;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `minifiedFile`
       */
      type?: 'minifiedFile';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          confidence: number;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `didYouMean`
       */
      type?: 'didYouMean';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          alternatePackage: string;
          editDistance: number;
          downloads: number;
          downloadsRatio: number;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `bidi`
       */
      type?: 'bidi';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {};
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `zeroWidth`
       */
      type?: 'zeroWidth';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {};
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `badEncoding`
       */
      type?: 'badEncoding';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          encoding: string;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `homoglyphs`
       */
      type?: 'homoglyphs';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {};
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `invisibleChars`
       */
      type?: 'invisibleChars';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {};
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `suspiciousString`
       */
      type?: 'suspiciousString';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          pattern: string;
          explanation: string;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `invalidPackageJSON`
       */
      type?: 'invalidPackageJSON';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {};
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `httpDependency`
       */
      type?: 'httpDependency';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          packageName: string;
          url: string;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `gitDependency`
       */
      type?: 'gitDependency';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          packageName: string;
          url: string;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `gitHubDependency`
       */
      type?: 'gitHubDependency';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          packageName: string;
          githubUser: string;
          githubRepo: string;
          commitsh: string;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `fileDependency`
       */
      type?: 'fileDependency';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          packageName: string;
          filePath: string;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `noTests`
       */
      type?: 'noTests';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {};
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `noRepository`
       */
      type?: 'noRepository';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {};
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `badSemver`
       */
      type?: 'badSemver';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {};
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `badSemverDependency`
       */
      type?: 'badSemverDependency';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          packageName: string;
          packageVersion: string;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `noV1`
       */
      type?: 'noV1';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {};
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `noWebsite`
       */
      type?: 'noWebsite';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {};
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `noBugTracker`
       */
      type?: 'noBugTracker';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {};
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `noAuthorData`
       */
      type?: 'noAuthorData';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {};
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `typeModuleCompatibility`
       */
      type?: 'typeModuleCompatibility';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {};
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `emptyPackage`
       */
      type?: 'emptyPackage';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {};
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `trivialPackage`
       */
      type?: 'trivialPackage';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          linesOfCode: number;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `noREADME`
       */
      type?: 'noREADME';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {};
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `deprecated`
       */
      type?: 'deprecated';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          reason: string;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `chronoAnomaly`
       */
      type?: 'chronoAnomaly';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          prevChronoDate: string;
          prevChronoVersion: string;
          prevSemverDate: string;
          prevSemverVersion: string;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `semverAnomaly`
       */
      type?: 'semverAnomaly';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          prevVersion: string;
          newVersion: string;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `newAuthor`
       */
      type?: 'newAuthor';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          prevAuthor: string;
          newAuthor: string;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `unstableOwnership`
       */
      type?: 'unstableOwnership';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          author: string;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `missingAuthor`
       */
      type?: 'missingAuthor';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {};
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `unmaintained`
       */
      type?: 'unmaintained';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          lastPublish: string;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `majorRefactor`
       */
      type?: 'majorRefactor';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          linesChanged: number;
          prevSize: number;
          curSize: number;
          changedPercent: number;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `unsafeCopyright`
       */
      type?: 'unsafeCopyright';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {};
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `licenseChange`
       */
      type?: 'licenseChange';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          prevLicenseId: string;
          newLicenseId: string;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `nonOSILicense`
       */
      type?: 'nonOSILicense';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          licenseId: string;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `deprecatedLicense`
       */
      type?: 'deprecatedLicense';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          licenseId: string;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `missingLicense`
       */
      type?: 'missingLicense';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {};
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `nonSPDXLicense`
       */
      type?: 'nonSPDXLicense';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {};
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `unclearLicense`
       */
      type?: 'unclearLicense';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          possibleLicenseId: string;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `mixedLicense`
       */
      type?: 'mixedLicense';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          licenseId: string;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `notice`
       */
      type?: 'notice';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {};
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `modifiedLicense`
       */
      type?: 'modifiedLicense';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          licenseId: string;
          similarity: number;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `modifiedException`
       */
      type?: 'modifiedException';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          exceptionId: string;
          similarity: number;
          comments: string;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `licenseException`
       */
      type?: 'licenseException';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          exceptionId: string;
          comments: string;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `deprecatedException`
       */
      type?: 'deprecatedException';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          exceptionId: string;
          comments: string;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `malware`
       */
      type?: 'malware';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          id: number;
          note: string;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `telemetry`
       */
      type?: 'telemetry';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          id: number;
          note: string;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
  | {
      /**
       * `troll`
       */
      type?: 'troll';
      value?: {
        /**
         * `low` `middle` `high` `critical`
         */
        severity: 'low' | 'middle' | 'high' | 'critical';
        /**
         * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
         */
        category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
        locations: (
          | {
              /**
               * `unknown`
               */
              type?: 'unknown';
              value?: {};
            }
          | {
              /**
               * `npm`
               */
              type?: 'npm';
              value?: {
                package: string;
                version?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `git`
               */
              type?: 'git';
              value?: {
                url: string;
                commit?: string;
                tag?: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
          | {
              /**
               * `web`
               */
              type?: 'web';
              value?: {
                url: string;
                file?: {
                  path: string;
                  range?: {
                    startLine: number;
                    startColumn: number;
                    endLine: number;
                    endColumn: number;
                  };
                  bytes?: {
                    start: number;
                    end: number;
                  };
                };
              };
            }
        )[];
        description: string;
        props: {
          id: number;
          note: string;
        };
        usage?: {
          file: {
            path: string;
            range?: {
              startLine: number;
              startColumn: number;
              endLine: number;
              endColumn: number;
            };
            bytes?: {
              start: number;
              end: number;
            };
          };
          dependencies: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
        };
      };
    }
)[];
interface GetIssuesByNPMPackage_Response_400 {
  error: {
    message: string;
  };
}
interface GetIssuesByNPMPackage_Response_401 {
  error: {
    message: string;
  };
}
interface GetIssuesByNPMPackage_Response_403 {
  error: {
    message: string;
  };
}
interface GetIssuesByNPMPackage_Response_404 {
  error: {
    message: string;
  };
}
interface GetIssuesByNPMPackage_Response_429 {
  error: {
    message: string;
  };
}
type GetScoreByNPMPackageMetadataParam = {
  package: string;
  version: string;
  [k: string]: unknown;
};
interface GetScoreByNPMPackage_Response_200 {
  supplyChainRisk: {
    score: number;
    components: {
      supplyChainRiskIssueLow: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      supplyChainRiskIssueMid: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      supplyChainRiskIssueHigh: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      supplyChainRiskIssueCritical: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      dependencyCount: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      devDependencyCount: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      unusedDependencyCount: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      transitiveDependencyCount: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      totalDependencyCount: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      downloadCount: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
    };
    limit?: number;
    /**
     * `0` `1` `2` `3` `4` `5` `6` `7` `8` `9`
     */
    limitingMetric?: '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
  };
  quality: {
    score: number;
    components: {
      qualityIssueLow: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      qualityIssueMid: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      qualityIssueHigh: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      qualityIssueCritical: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      linesOfCode: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      readmeLength: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      bundlesize?: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      stargazers?: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      forks?: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      watchers?: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
    };
    limit?: number;
    /**
     * `0` `1` `2` `3` `4` `5` `6` `7` `8` `9`
     */
    limitingMetric?: '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
  };
  maintenance: {
    score: number;
    components: {
      maintenanceIssueLow: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      maintenanceIssueMid: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      maintenanceIssueHigh: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      maintenanceIssueCritical: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      maintainerCount: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      versionsLastWeek: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      versionsLastMonth: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      versionsLastTwoMonths: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      versionsLastYear: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      versionCount: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      openIssues?: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      closedIssues?: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      commitsLastWeek?: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      commitsLastMonth?: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      commitsLastTwoMonths?: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      commitsLastYear?: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      commits?: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
    };
    limit?: number;
    /**
     * `0` `1` `2` `3` `4` `5` `6` `7` `8` `9` `10` `11` `12` `13` `14` `15` `16`
     */
    limitingMetric?:
      | '0'
      | '1'
      | '2'
      | '3'
      | '4'
      | '5'
      | '6'
      | '7'
      | '8'
      | '9'
      | '10'
      | '11'
      | '12'
      | '13'
      | '14'
      | '15'
      | '16';
  };
  vulnerability: {
    score: number;
    components: {
      vulnerabilityIssueLow: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      vulnerabilityIssueMid: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      vulnerabilityIssueHigh: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      vulnerabilityIssueCritical: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      dependencyVulnerabilityCount: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      vulnerabilityCount: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
    };
    limit?: number;
    /**
     * `0` `1` `2` `3` `4` `5`
     */
    limitingMetric?: '0' | '1' | '2' | '3' | '4' | '5';
  };
  license: {
    score: number;
    components: {
      licenseIssueLow: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      licenseIssueMid: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      licenseIssueHigh: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      licenseIssueCritical: {
        score: number;
        maxScore: number;
        limit: number;
        value: number;
      };
      licenseQuality: {
        score: number;
        maxScore: number;
        limit: number;
        /**
         * `model` `gold` `silver` `bronze` `lead` `nonfree` `unknown` `unlicensed`
         */
        value: 'model' | 'gold' | 'silver' | 'bronze' | 'lead' | 'nonfree' | 'unknown' | 'unlicensed';
      };
    };
    limit?: number;
    /**
     * `0` `1` `2` `3` `4`
     */
    limitingMetric?: '0' | '1' | '2' | '3' | '4';
  };
  miscellaneous: {
    score: number;
    components: {
      typeModule: {
        score: number;
        maxScore: number;
        limit: number;
        value: boolean;
      };
      defaultBranch?: {
        score: number;
        maxScore: number;
        limit: number;
        value: string;
      };
      repoCreatedAt?: {
        score: number;
        maxScore: number;
        limit: number;
        value: string;
      };
    };
    limit?: number;
    /**
     * `0` `1` `2`
     */
    limitingMetric?: '0' | '1' | '2';
  };
  depscore: number;
}
interface GetScoreByNPMPackage_Response_400 {
  error: {
    message: string;
  };
}
interface GetScoreByNPMPackage_Response_401 {
  error: {
    message: string;
  };
}
interface GetScoreByNPMPackage_Response_403 {
  error: {
    message: string;
  };
}
interface GetScoreByNPMPackage_Response_404 {
  error: {
    message: string;
  };
}
interface GetScoreByNPMPackage_Response_429 {
  error: {
    message: string;
  };
}
type GetReportList_Response_200 = {
  id: string;
  url: string;
}[];
interface GetReportList_Response_400 {
  error: {
    message: string;
  };
}
interface GetReportList_Response_401 {
  error: {
    message: string;
  };
}
interface GetReportList_Response_403 {
  error: {
    message: string;
  };
}
interface GetReportList_Response_404 {
  error: {
    message: string;
  };
}
interface GetReportList_Response_429 {
  error: {
    message: string;
  };
}
interface CreateReportBodyParam {
  [k: string]: string;
}
interface CreateReport_Response_200 {
  id: string;
  url: string;
}
interface CreateReport_Response_400 {
  error: {
    message: string;
  };
}
interface CreateReport_Response_401 {
  error: {
    message: string;
  };
}
interface CreateReport_Response_403 {
  error: {
    message: string;
  };
}
interface CreateReport_Response_404 {
  error: {
    message: string;
  };
}
interface CreateReport_Response_429 {
  error: {
    message: string;
  };
}
type GetReportMetadataParam = {
  id: string;
  [k: string]: unknown;
};
interface GetReport_Response_200 {
  issues: (
    | {
        /**
         * `criticalCVE`
         */
        type?: 'criticalCVE';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            id: number;
            title: string;
            severity: string;
            url: string;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `cve`
         */
        type?: 'cve';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            id: number;
            title: string;
            severity: string;
            url: string;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `mildCVE`
         */
        type?: 'mildCVE';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            id: number;
            title: string;
            severity: string;
            url: string;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `installScripts`
         */
        type?: 'installScripts';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            script: string;
            source: string;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `hasNativeCode`
         */
        type?: 'hasNativeCode';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {};
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `binScriptConfusion`
         */
        type?: 'binScriptConfusion';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            binScript: string;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `shellScriptOverride`
         */
        type?: 'shellScriptOverride';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            binScript: string;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `filesystemAccess`
         */
        type?: 'filesystemAccess';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            module: string;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `networkAccess`
         */
        type?: 'networkAccess';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            module: string;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `shellAccess`
         */
        type?: 'shellAccess';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            module: string;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `debugAccess`
         */
        type?: 'debugAccess';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            module: string;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `longStrings`
         */
        type?: 'longStrings';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {};
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `highEntropyStrings`
         */
        type?: 'highEntropyStrings';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {};
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `urlStrings`
         */
        type?: 'urlStrings';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            urlFragment: string;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `usesEval`
         */
        type?: 'usesEval';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            evalType: string;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `dynamicRequire`
         */
        type?: 'dynamicRequire';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {};
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `envVars`
         */
        type?: 'envVars';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            envVars: string;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `missingDependency`
         */
        type?: 'missingDependency';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            name: string;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `unusedDependency`
         */
        type?: 'unusedDependency';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            name: string;
            version: string;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `peerDependency`
         */
        type?: 'peerDependency';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            name: string;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `uncaughtOptionalDependency`
         */
        type?: 'uncaughtOptionalDependency';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            name: string;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `unresolvedRequire`
         */
        type?: 'unresolvedRequire';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {};
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `extraneousDependency`
         */
        type?: 'extraneousDependency';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {};
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `obfuscatedRequire`
         */
        type?: 'obfuscatedRequire';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {};
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `obfuscatedFile`
         */
        type?: 'obfuscatedFile';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            confidence: number;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `minifiedFile`
         */
        type?: 'minifiedFile';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            confidence: number;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `didYouMean`
         */
        type?: 'didYouMean';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            alternatePackage: string;
            editDistance: number;
            downloads: number;
            downloadsRatio: number;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `bidi`
         */
        type?: 'bidi';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {};
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `zeroWidth`
         */
        type?: 'zeroWidth';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {};
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `badEncoding`
         */
        type?: 'badEncoding';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            encoding: string;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `homoglyphs`
         */
        type?: 'homoglyphs';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {};
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `invisibleChars`
         */
        type?: 'invisibleChars';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {};
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `suspiciousString`
         */
        type?: 'suspiciousString';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            pattern: string;
            explanation: string;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `invalidPackageJSON`
         */
        type?: 'invalidPackageJSON';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {};
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `httpDependency`
         */
        type?: 'httpDependency';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            packageName: string;
            url: string;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `gitDependency`
         */
        type?: 'gitDependency';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            packageName: string;
            url: string;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `gitHubDependency`
         */
        type?: 'gitHubDependency';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            packageName: string;
            githubUser: string;
            githubRepo: string;
            commitsh: string;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `fileDependency`
         */
        type?: 'fileDependency';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            packageName: string;
            filePath: string;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `noTests`
         */
        type?: 'noTests';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {};
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `noRepository`
         */
        type?: 'noRepository';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {};
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `badSemver`
         */
        type?: 'badSemver';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {};
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `badSemverDependency`
         */
        type?: 'badSemverDependency';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            packageName: string;
            packageVersion: string;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `noV1`
         */
        type?: 'noV1';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {};
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `noWebsite`
         */
        type?: 'noWebsite';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {};
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `noBugTracker`
         */
        type?: 'noBugTracker';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {};
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `noAuthorData`
         */
        type?: 'noAuthorData';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {};
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `typeModuleCompatibility`
         */
        type?: 'typeModuleCompatibility';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {};
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `emptyPackage`
         */
        type?: 'emptyPackage';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {};
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `trivialPackage`
         */
        type?: 'trivialPackage';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            linesOfCode: number;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `noREADME`
         */
        type?: 'noREADME';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {};
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `deprecated`
         */
        type?: 'deprecated';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            reason: string;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `chronoAnomaly`
         */
        type?: 'chronoAnomaly';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            prevChronoDate: string;
            prevChronoVersion: string;
            prevSemverDate: string;
            prevSemverVersion: string;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `semverAnomaly`
         */
        type?: 'semverAnomaly';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            prevVersion: string;
            newVersion: string;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `newAuthor`
         */
        type?: 'newAuthor';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            prevAuthor: string;
            newAuthor: string;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `unstableOwnership`
         */
        type?: 'unstableOwnership';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            author: string;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `missingAuthor`
         */
        type?: 'missingAuthor';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {};
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `unmaintained`
         */
        type?: 'unmaintained';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            lastPublish: string;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `majorRefactor`
         */
        type?: 'majorRefactor';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            linesChanged: number;
            prevSize: number;
            curSize: number;
            changedPercent: number;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `unsafeCopyright`
         */
        type?: 'unsafeCopyright';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {};
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `licenseChange`
         */
        type?: 'licenseChange';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            prevLicenseId: string;
            newLicenseId: string;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `nonOSILicense`
         */
        type?: 'nonOSILicense';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            licenseId: string;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `deprecatedLicense`
         */
        type?: 'deprecatedLicense';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            licenseId: string;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `missingLicense`
         */
        type?: 'missingLicense';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {};
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `nonSPDXLicense`
         */
        type?: 'nonSPDXLicense';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {};
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `unclearLicense`
         */
        type?: 'unclearLicense';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            possibleLicenseId: string;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `mixedLicense`
         */
        type?: 'mixedLicense';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            licenseId: string;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `notice`
         */
        type?: 'notice';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {};
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `modifiedLicense`
         */
        type?: 'modifiedLicense';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            licenseId: string;
            similarity: number;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `modifiedException`
         */
        type?: 'modifiedException';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            exceptionId: string;
            similarity: number;
            comments: string;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `licenseException`
         */
        type?: 'licenseException';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            exceptionId: string;
            comments: string;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `deprecatedException`
         */
        type?: 'deprecatedException';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            exceptionId: string;
            comments: string;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `malware`
         */
        type?: 'malware';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            id: number;
            note: string;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `telemetry`
         */
        type?: 'telemetry';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            id: number;
            note: string;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
    | {
        /**
         * `troll`
         */
        type?: 'troll';
        value?: {
          /**
           * `low` `middle` `high` `critical`
           */
          severity: 'low' | 'middle' | 'high' | 'critical';
          /**
           * `supplyChainRisk` `quality` `maintenance` `vulnerability` `license` `miscellaneous`
           */
          category: 'supplyChainRisk' | 'quality' | 'maintenance' | 'vulnerability' | 'license' | 'miscellaneous';
          locations: (
            | {
                /**
                 * `unknown`
                 */
                type?: 'unknown';
                value?: {};
              }
            | {
                /**
                 * `npm`
                 */
                type?: 'npm';
                value?: {
                  package: string;
                  version?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `git`
                 */
                type?: 'git';
                value?: {
                  url: string;
                  commit?: string;
                  tag?: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
            | {
                /**
                 * `web`
                 */
                type?: 'web';
                value?: {
                  url: string;
                  file?: {
                    path: string;
                    range?: {
                      startLine: number;
                      startColumn: number;
                      endLine: number;
                      endColumn: number;
                    };
                    bytes?: {
                      start: number;
                      end: number;
                    };
                  };
                };
              }
          )[];
          description: string;
          props: {
            id: number;
            note: string;
          };
          usage?: {
            file: {
              path: string;
              range?: {
                startLine: number;
                startColumn: number;
                endLine: number;
                endColumn: number;
              };
              bytes?: {
                start: number;
                end: number;
              };
            };
            dependencies: (
              | {
                  /**
                   * `unknown`
                   */
                  type?: 'unknown';
                  value?: {};
                }
              | {
                  /**
                   * `npm`
                   */
                  type?: 'npm';
                  value?: {
                    package: string;
                    version?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `git`
                   */
                  type?: 'git';
                  value?: {
                    url: string;
                    commit?: string;
                    tag?: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
              | {
                  /**
                   * `web`
                   */
                  type?: 'web';
                  value?: {
                    url: string;
                    file?: {
                      path: string;
                      range?: {
                        startLine: number;
                        startColumn: number;
                        endLine: number;
                        endColumn: number;
                      };
                      bytes?: {
                        start: number;
                        end: number;
                      };
                    };
                  };
                }
            )[];
          };
        };
      }
  )[];
  score: {
    avgSupplyChainRisk: number;
    avgQuality: number;
    avgMaintenance: number;
    avgVulnerability: number;
    avgLicense: number;
  };
}
interface GetReport_Response_400 {
  error: {
    message: string;
  };
}
interface GetReport_Response_401 {
  error: {
    message: string;
  };
}
interface GetReport_Response_403 {
  error: {
    message: string;
  };
}
interface GetReport_Response_404 {
  error: {
    message: string;
  };
}
interface GetReport_Response_429 {
  error: {
    message: string;
  };
}
interface GetOpenAPI_Response_200 {
  [k: string]: unknown;
}
interface GetOpenAPI_Response_429 {
  error: {
    message: string;
  };
}
interface GetQuota_Response_200 {
  quota: number;
}
interface GetQuota_Response_401 {
  error: {
    message: string;
  };
}
interface GetQuota_Response_429 {
  error: {
    message: string;
  };
}
