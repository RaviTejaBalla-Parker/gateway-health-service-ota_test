
var rp = require('request-promise');

let debug = false;

let azureToken = undefined;
//let azureURL; let grantType; let azureResource; let clientID; let clientSecret;
let inputParameters;

async function getDeviceProfileData(DEVICE_PROFILE_PARAMETERS) {
    try {
        //azureURL = AZURE_URL; grantType = GRANT_TYPE; azureResource = AZURE_RESOURCE; 
        //clientID = CLIENT_ID; clientSecret = CLIENT_SECRET;
        let deviceProfiles = [];
        deviceProfiles.length = 0;
        inputParameters = DEVICE_PROFILE_PARAMETERS;

        await getDeviceProfilePage1Data(deviceProfiles);
        return deviceProfiles;
    }
    catch (error) {
        throw error;
    }
}

async function getDeviceProfilePage1Data(deviceProfiles) {
    let isAPIExecuted = false; let retryCount = 0; let maxAttempt = 4;
    let pageCounter = 1; let totalPages = 50;
    console.log("getDeviceProfilePage1Data");

    while (!isAPIExecuted && retryCount <= maxAttempt) {
        try {
            if (azureToken === undefined) {
                //azureToken = "ABCD" 
                azureToken = await getAzureToken();
            }

            // if(retryCount == 0)
            //     throw 'error'

            let devicesInfo = await getDevices(pageCounter, azureToken);

            totalPages = devicesInfo.totalPages;
            console.log(`DeviceProfile Total Pages:${totalPages}`);
            pushDeviceProfileInfo(devicesInfo, deviceProfiles);
            isAPIExecuted = true;

        } catch (error) {
            console.log(`Failed to fetch page ${pageCounter}:${error}; Retry page ${pageCounter}`);
            isAPIExecuted = false;
            azureToken = await getAzureToken();
            retryCount = retryCount + 1;
            //console.log(`retryCount: ${retryCount}`);
        }

    }
    if (retryCount > maxAttempt) {
        console.log(`Failed to fetch device profile api at page ${pageCounter}`);
    }
    await getNextDeviceProfiles(totalPages, deviceProfiles);
    //console.log(deviceProfiles[0]);
}

async function getNextDeviceProfiles(totalPages, deviceProfiles) {
    console.log("getNextDeviceProfiles");

    let isAPIExecuted = false; let retryCount = 0; let maxAttempt = 4;
    let pageCounter = 2;

    while (!isAPIExecuted && retryCount <= maxAttempt) {
        try {

            azureToken = await getAzureToken();
            for (let i = pageCounter; i <= totalPages; i++) {

                pageCounter = i;
                let devicesInfo = await getDevices(pageCounter, azureToken);
                console.log(`Page ${i} lenght:${devicesInfo.results.length}`);
                retryCount = 0;
                pushDeviceProfileInfo(devicesInfo, deviceProfiles);

                if (debug && pageCounter == 25)
                    break;
            }
            isAPIExecuted = true;
        } catch (error) {
            console.log(`Failed to fetch page ${pageCounter}:${error}; Retry page ${pageCounter}`);
            isAPIExecuted = false;
            retryCount = retryCount + 1;
            //console.log(`retryCount: ${retryCount}`);

            if (retryCount > maxAttempt) {
                console.log(`Failed to fetch device profile api at page ${pageCounter}`);
                pageCounter++;
                retryCount = 0;
            }

            if (pageCounter > totalPages) {
                console.log(`PageCounter > totalPage: ${pageCounter}`);
                isAPIExecuted = true;
            }
        }
    }
    //console.log(`deviceProfiles length:${deviceProfiles.length}`);
}

function pushDeviceProfileInfo(deviceProfilePageInfo, deviceProfiles) {
    try {
        //console.log("pushDeviceProfileInfo");

        for (let i = 0; i < deviceProfilePageInfo.results.length; i++) {
            let deviceData = [];
            deviceData["deviceId"] = deviceProfilePageInfo.results[i].deviceId;
            //console.log(deviceData["deviceId"]);
            let gatewayAssets = deviceProfilePageInfo.results[i].assets.filter(a => a.assetType == 'GATEWAY');

            // OPS-2491: Fetch customer number and name from latest asset (createDate)
            let deviceAssets = deviceProfilePageInfo.results[i].assets;
            let latestCustomerDetails;
            if (deviceAssets.length >= 1) {
                //console.log(deviceAssets);

                let maxDate = new Date(Math.max.apply(null, deviceAssets.map(function (e) {
                    return new Date(e.createDate);
                })));

                latestCustomerDetails = deviceAssets.find(f => Date.parse(f.createDate) == Date.parse(maxDate));
                //console.log(latestCustomerDetails);
                if(latestCustomerDetails){
                    deviceData["customerNumber"] = latestCustomerDetails.customerNumber;
                    deviceData["customerName"] = latestCustomerDetails.customerName;
                    deviceData["latestPartNumber"] = latestCustomerDetails.partNumber;
                }
            }
            //

            if (gatewayAssets.length > 1) {
                let maxDate; let minDate; let latestAsset; let orginalAsset;

                maxDate = new Date(Math.max.apply(null, gatewayAssets.map(function (e) {
                    return new Date(e.createDate);
                })));

                minDate = new Date(Math.min.apply(null, gatewayAssets.map(function (e) {
                    return new Date(e.createDate);
                })));

                latestAsset = gatewayAssets.find(f => Date.parse(f.createDate) == Date.parse(maxDate));

                orginalAsset = gatewayAssets.find(f => Date.parse(f.createDate) == Date.parse(minDate));

                if (latestAsset !== undefined) {
                    deviceData["ptsID"] = latestAsset.assetId;                   
                    deviceData["shippedDate"] = latestAsset.customData2;
                    deviceData["partNumber"] = latestAsset.partNumber;
                }

                // If it is replacement gateway (166036). Get orginal part number into latestPartNumber
                if (deviceData["latestPartNumber"].includes('ECD')) {
                    deviceData["latestPartNumber"] = deviceData["latestPartNumber"].replace(/ECD/g, '');
                }

                if(deviceData["latestPartNumber"] === "166036" && orginalAsset){
                    deviceData["latestPartNumber"] = orginalAsset.partNumber;
                }
            }
            else if (deviceProfilePageInfo.results[i].assets !== undefined && deviceProfilePageInfo.results[i].assets.length > 0) {
                deviceData["ptsID"] = deviceProfilePageInfo.results[i].assets[0].assetId;               
                deviceData["shippedDate"] = deviceProfilePageInfo.results[i].assets[0].customData2;
                deviceData["partNumber"] = deviceProfilePageInfo.results[i].assets[0].partNumber;
            }

            if (deviceProfilePageInfo.results[i].cellularData !== undefined) {
                deviceData["iccid"] = deviceProfilePageInfo.results[i].cellularData.iccid;
                deviceData["currDataUsage"] = deviceProfilePageInfo.results[i].cellularData.currentUsage; // Current data usage in bytes
                deviceData["currDataUsageDisplay"] = deviceProfilePageInfo.results[i].cellularData.currentUsageDisplay;// Current data usage formatted for display
                deviceData["currDataUsageSince"] = deviceProfilePageInfo.results[i].cellularData.dataCurrentSince; // Display formatted timestamp of when data was last pulled from AT&T
                deviceData["currDataUsageSinceISO"] = deviceProfilePageInfo.results[i].cellularData.dataCurrentSinceISO; // ISO formatted timestamp of when data was last pulled from AT&T
                deviceData["currStatus"] = deviceProfilePageInfo.results[i].cellularData.status; // Sim activation status
                deviceData["currRatePlan"] = deviceProfilePageInfo.results[i].cellularData.ratePlan; // Current AT&T Rate Plan
                deviceData["currCommunicationPlan"] = deviceProfilePageInfo.results[i].cellularData.communicationPlan; // Current AT&T Communication Plan
            }
            deviceProfiles.push(deviceData);
        }
        console.log(`deviceProfiles length:${deviceProfiles.length}`);

    } catch (error) {
        console.log(error.message);
        //throw error;
    }

}

getAzureToken = () => {
    return new Promise((resolve, reject) => {
        var azureTokenApi = {
            method: 'POST',
            url: inputParameters.azureURL,
            formData: {
                'grant_type': inputParameters.grantType,
                'resource': inputParameters.azureResource,
                'client_id': inputParameters.clientID,
                'client_secret': inputParameters.clientSecret
            },
            strictSSL: false
        }

        rp(azureTokenApi)
            .then(azureResponse => {
                azureToken = JSON.parse(azureResponse).access_token;
                return resolve(azureToken);
            }).catch(error => reject(error));
    });
}

getDevices = (pageCounter, azureToken) => {

    return new Promise((resolve, reject) => {
        var deviceProfileApi = {
            method: 'GET',
            url: `${inputParameters.vomURL}?page=${pageCounter}&cellularData=Y`,
            headers: { 'Content-type': 'application/json', 'authorization': `bearer ${azureToken}` }            
        }
        rp(deviceProfileApi)
            .then((deviceProfileResponse) => {
                deviceProfilePage = JSON.parse(deviceProfileResponse);
                return resolve(deviceProfilePage);
            })
            .catch(error => reject(error));
    });
}

module.exports = {
    getDeviceProfileData
}
