# .DefaultApi

All URIs are relative to *http://localhost:4000/api/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**npmPackageVersionIssuesGet**](DefaultApi.md#npmPackageVersionIssuesGet) | **GET** /npm/{package}/{version}/issues | 
[**npmPackageVersionScoreGet**](DefaultApi.md#npmPackageVersionScoreGet) | **GET** /npm/{package}/{version}/score | 
[**quotaGet**](DefaultApi.md#quotaGet) | **GET** /quota | 
[**reportListGet**](DefaultApi.md#reportListGet) | **GET** /report/list | 
[**reportUploadPut**](DefaultApi.md#reportUploadPut) | **PUT** /report/upload | 
[**reportViewIdGet**](DefaultApi.md#reportViewIdGet) | **GET** /report/view/{id} | 


# **npmPackageVersionIssuesGet**
> Array<SocketIssue> npmPackageVersionIssuesGet()


### Example


```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiNpmPackageVersionIssuesGetRequest = {
  // string
  _package: "package_example",
  // string
  version: "4.072888001528021798096225500850762068629.39333975650685139102691291732729478601482026",
};

apiInstance.npmPackageVersionIssuesGet(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```


### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **_package** | [**string**] |  | defaults to undefined
 **version** | [**string**] |  | defaults to undefined


### Return type

**Array<SocketIssue>**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | I&#39;m a json |  -  |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **npmPackageVersionScoreGet**
> SocketPackageScore npmPackageVersionScoreGet()


### Example


```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiNpmPackageVersionScoreGetRequest = {
  // string
  _package: "package_example",
  // string
  version: "4.072888001528021798096225500850762068629.39333975650685139102691291732729478601482026",
};

apiInstance.npmPackageVersionScoreGet(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```


### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **_package** | [**string**] |  | defaults to undefined
 **version** | [**string**] |  | defaults to undefined


### Return type

**SocketPackageScore**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | I&#39;m a json |  -  |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **quotaGet**
> InlineResponse2001 quotaGet()


### Example


```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:any = {};

apiInstance.quotaGet(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```


### Parameters
This endpoint does not need any parameter.


### Return type

**InlineResponse2001**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | I&#39;m a json |  -  |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **reportListGet**
> any reportListGet()


### Example


```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:any = {};

apiInstance.reportListGet(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```


### Parameters
This endpoint does not need any parameter.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | I&#39;m a json |  -  |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **reportUploadPut**
> InlineResponse200 reportUploadPut()


### Example


```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:any = {};

apiInstance.reportUploadPut(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```


### Parameters
This endpoint does not need any parameter.


### Return type

**InlineResponse200**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | I&#39;m a json |  -  |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **reportViewIdGet**
> SocketReport reportViewIdGet()


### Example


```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiReportViewIdGetRequest = {
  // string
  id: "id_example",
};

apiInstance.reportViewIdGet(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```


### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | [**string**] |  | defaults to undefined


### Return type

**SocketReport**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | I&#39;m a json |  -  |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)


