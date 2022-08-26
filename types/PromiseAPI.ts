import { ResponseContext, RequestContext, HttpFile } from '../http/http';
import * as models from '../models/all';
import { Configuration} from '../configuration'

import { InlineResponse200 } from '../models/InlineResponse200';
import { InlineResponse2001 } from '../models/InlineResponse2001';
import { SocketCategory } from '../models/SocketCategory';
import { SocketIssue } from '../models/SocketIssue';
import { SocketIssueAnyOf } from '../models/SocketIssueAnyOf';
import { SocketIssueAnyOf1 } from '../models/SocketIssueAnyOf1';
import { SocketIssueAnyOf10 } from '../models/SocketIssueAnyOf10';
import { SocketIssueAnyOf11 } from '../models/SocketIssueAnyOf11';
import { SocketIssueAnyOf12 } from '../models/SocketIssueAnyOf12';
import { SocketIssueAnyOf13 } from '../models/SocketIssueAnyOf13';
import { SocketIssueAnyOf14 } from '../models/SocketIssueAnyOf14';
import { SocketIssueAnyOf15 } from '../models/SocketIssueAnyOf15';
import { SocketIssueAnyOf16 } from '../models/SocketIssueAnyOf16';
import { SocketIssueAnyOf17 } from '../models/SocketIssueAnyOf17';
import { SocketIssueAnyOf18 } from '../models/SocketIssueAnyOf18';
import { SocketIssueAnyOf19 } from '../models/SocketIssueAnyOf19';
import { SocketIssueAnyOf2 } from '../models/SocketIssueAnyOf2';
import { SocketIssueAnyOf20 } from '../models/SocketIssueAnyOf20';
import { SocketIssueAnyOf21 } from '../models/SocketIssueAnyOf21';
import { SocketIssueAnyOf22 } from '../models/SocketIssueAnyOf22';
import { SocketIssueAnyOf23 } from '../models/SocketIssueAnyOf23';
import { SocketIssueAnyOf24 } from '../models/SocketIssueAnyOf24';
import { SocketIssueAnyOf25 } from '../models/SocketIssueAnyOf25';
import { SocketIssueAnyOf26 } from '../models/SocketIssueAnyOf26';
import { SocketIssueAnyOf27 } from '../models/SocketIssueAnyOf27';
import { SocketIssueAnyOf28 } from '../models/SocketIssueAnyOf28';
import { SocketIssueAnyOf29 } from '../models/SocketIssueAnyOf29';
import { SocketIssueAnyOf3 } from '../models/SocketIssueAnyOf3';
import { SocketIssueAnyOf30 } from '../models/SocketIssueAnyOf30';
import { SocketIssueAnyOf31 } from '../models/SocketIssueAnyOf31';
import { SocketIssueAnyOf32 } from '../models/SocketIssueAnyOf32';
import { SocketIssueAnyOf33 } from '../models/SocketIssueAnyOf33';
import { SocketIssueAnyOf34 } from '../models/SocketIssueAnyOf34';
import { SocketIssueAnyOf35 } from '../models/SocketIssueAnyOf35';
import { SocketIssueAnyOf36 } from '../models/SocketIssueAnyOf36';
import { SocketIssueAnyOf37 } from '../models/SocketIssueAnyOf37';
import { SocketIssueAnyOf38 } from '../models/SocketIssueAnyOf38';
import { SocketIssueAnyOf39 } from '../models/SocketIssueAnyOf39';
import { SocketIssueAnyOf4 } from '../models/SocketIssueAnyOf4';
import { SocketIssueAnyOf40 } from '../models/SocketIssueAnyOf40';
import { SocketIssueAnyOf41 } from '../models/SocketIssueAnyOf41';
import { SocketIssueAnyOf42 } from '../models/SocketIssueAnyOf42';
import { SocketIssueAnyOf43 } from '../models/SocketIssueAnyOf43';
import { SocketIssueAnyOf44 } from '../models/SocketIssueAnyOf44';
import { SocketIssueAnyOf45 } from '../models/SocketIssueAnyOf45';
import { SocketIssueAnyOf46 } from '../models/SocketIssueAnyOf46';
import { SocketIssueAnyOf47 } from '../models/SocketIssueAnyOf47';
import { SocketIssueAnyOf48 } from '../models/SocketIssueAnyOf48';
import { SocketIssueAnyOf49 } from '../models/SocketIssueAnyOf49';
import { SocketIssueAnyOf5 } from '../models/SocketIssueAnyOf5';
import { SocketIssueAnyOf50 } from '../models/SocketIssueAnyOf50';
import { SocketIssueAnyOf51 } from '../models/SocketIssueAnyOf51';
import { SocketIssueAnyOf52 } from '../models/SocketIssueAnyOf52';
import { SocketIssueAnyOf53 } from '../models/SocketIssueAnyOf53';
import { SocketIssueAnyOf54 } from '../models/SocketIssueAnyOf54';
import { SocketIssueAnyOf55 } from '../models/SocketIssueAnyOf55';
import { SocketIssueAnyOf56 } from '../models/SocketIssueAnyOf56';
import { SocketIssueAnyOf57 } from '../models/SocketIssueAnyOf57';
import { SocketIssueAnyOf58 } from '../models/SocketIssueAnyOf58';
import { SocketIssueAnyOf59 } from '../models/SocketIssueAnyOf59';
import { SocketIssueAnyOf6 } from '../models/SocketIssueAnyOf6';
import { SocketIssueAnyOf60 } from '../models/SocketIssueAnyOf60';
import { SocketIssueAnyOf61 } from '../models/SocketIssueAnyOf61';
import { SocketIssueAnyOf62 } from '../models/SocketIssueAnyOf62';
import { SocketIssueAnyOf63 } from '../models/SocketIssueAnyOf63';
import { SocketIssueAnyOf64 } from '../models/SocketIssueAnyOf64';
import { SocketIssueAnyOf65 } from '../models/SocketIssueAnyOf65';
import { SocketIssueAnyOf66 } from '../models/SocketIssueAnyOf66';
import { SocketIssueAnyOf67 } from '../models/SocketIssueAnyOf67';
import { SocketIssueAnyOf68 } from '../models/SocketIssueAnyOf68';
import { SocketIssueAnyOf69 } from '../models/SocketIssueAnyOf69';
import { SocketIssueAnyOf7 } from '../models/SocketIssueAnyOf7';
import { SocketIssueAnyOf70 } from '../models/SocketIssueAnyOf70';
import { SocketIssueAnyOf71 } from '../models/SocketIssueAnyOf71';
import { SocketIssueAnyOf8 } from '../models/SocketIssueAnyOf8';
import { SocketIssueAnyOf9 } from '../models/SocketIssueAnyOf9';
import { SocketIssueBasics } from '../models/SocketIssueBasics';
import { SocketIssueSeverity } from '../models/SocketIssueSeverity';
import { SocketLicenseQuality } from '../models/SocketLicenseQuality';
import { SocketLicenseScore } from '../models/SocketLicenseScore';
import { SocketLicenseScoreComponents } from '../models/SocketLicenseScoreComponents';
import { SocketLicenseScoreComponentsLicenseQuality } from '../models/SocketLicenseScoreComponentsLicenseQuality';
import { SocketMaintenanceScore } from '../models/SocketMaintenanceScore';
import { SocketMaintenanceScoreComponents } from '../models/SocketMaintenanceScoreComponents';
import { SocketMiscellaneousScore } from '../models/SocketMiscellaneousScore';
import { SocketMiscellaneousScoreComponents } from '../models/SocketMiscellaneousScoreComponents';
import { SocketMiscellaneousScoreComponentsDefaultBranch } from '../models/SocketMiscellaneousScoreComponentsDefaultBranch';
import { SocketMiscellaneousScoreComponentsRepoCreatedAt } from '../models/SocketMiscellaneousScoreComponentsRepoCreatedAt';
import { SocketMiscellaneousScoreComponentsTypeModule } from '../models/SocketMiscellaneousScoreComponentsTypeModule';
import { SocketPackageScore } from '../models/SocketPackageScore';
import { SocketQualityScore } from '../models/SocketQualityScore';
import { SocketQualityScoreComponents } from '../models/SocketQualityScoreComponents';
import { SocketRef } from '../models/SocketRef';
import { SocketRefAnyOf } from '../models/SocketRefAnyOf';
import { SocketRefAnyOf1 } from '../models/SocketRefAnyOf1';
import { SocketRefAnyOf2 } from '../models/SocketRefAnyOf2';
import { SocketRefAnyOf3 } from '../models/SocketRefAnyOf3';
import { SocketRefByteRange } from '../models/SocketRefByteRange';
import { SocketRefFile } from '../models/SocketRefFile';
import { SocketRefGit } from '../models/SocketRefGit';
import { SocketRefNPM } from '../models/SocketRefNPM';
import { SocketRefTextRange } from '../models/SocketRefTextRange';
import { SocketRefWeb } from '../models/SocketRefWeb';
import { SocketReport } from '../models/SocketReport';
import { SocketReportDependency } from '../models/SocketReportDependency';
import { SocketReportScore } from '../models/SocketReportScore';
import { SocketSupplyChainScore } from '../models/SocketSupplyChainScore';
import { SocketSupplyChainScoreComponents } from '../models/SocketSupplyChainScoreComponents';
import { SocketSupplyChainScoreComponentsSupplyChainRiskIssueLow } from '../models/SocketSupplyChainScoreComponentsSupplyChainRiskIssueLow';
import { SocketUsageRef } from '../models/SocketUsageRef';
import { SocketVulnerabilityScore } from '../models/SocketVulnerabilityScore';
import { SocketVulnerabilityScoreComponents } from '../models/SocketVulnerabilityScoreComponents';
import { ObservableDefaultApi } from './ObservableAPI';

import { DefaultApiRequestFactory, DefaultApiResponseProcessor} from "../apis/DefaultApi";
export class PromiseDefaultApi {
    private api: ObservableDefaultApi

    public constructor(
        configuration: Configuration,
        requestFactory?: DefaultApiRequestFactory,
        responseProcessor?: DefaultApiResponseProcessor
    ) {
        this.api = new ObservableDefaultApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * @param _package 
     * @param version 
     */
    public npmPackageVersionIssuesGet(_package: string, version: string, _options?: Configuration): Promise<Array<SocketIssue>> {
        const result = this.api.npmPackageVersionIssuesGet(_package, version, _options);
        return result.toPromise();
    }

    /**
     * @param _package 
     * @param version 
     */
    public npmPackageVersionScoreGet(_package: string, version: string, _options?: Configuration): Promise<SocketPackageScore> {
        const result = this.api.npmPackageVersionScoreGet(_package, version, _options);
        return result.toPromise();
    }

    /**
     */
    public quotaGet(_options?: Configuration): Promise<InlineResponse2001> {
        const result = this.api.quotaGet(_options);
        return result.toPromise();
    }

    /**
     */
    public reportListGet(_options?: Configuration): Promise<any> {
        const result = this.api.reportListGet(_options);
        return result.toPromise();
    }

    /**
     */
    public reportUploadPut(_options?: Configuration): Promise<InlineResponse200> {
        const result = this.api.reportUploadPut(_options);
        return result.toPromise();
    }

    /**
     * @param id 
     */
    public reportViewIdGet(id: string, _options?: Configuration): Promise<SocketReport> {
        const result = this.api.reportViewIdGet(id, _options);
        return result.toPromise();
    }


}



