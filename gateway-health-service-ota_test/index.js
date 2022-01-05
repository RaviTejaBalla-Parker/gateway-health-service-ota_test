const fs = require('fs');
var rp = require('request-promise');
const azure = require('azure-storage');
const registryAzureIotHub = require('azure-iothub').Registry;
const cosmos = require("@azure/cosmos");
const configSettings = require('./configSettingsDev.json');
//const configSettings = require('./configSettings.json');
//const configSettings = require('./configSettingsStaging.json');
var partNumberMetaData = require('./src/partNumberMetaData').getPartNumberMetaData;
var deviceTwinData = require('./src/deviceTwinData').getDeviceTwinData;
var uploadDataToCosmos = require('./src/uploadDataToCosmos').upsertDocument;
var deviceProfileData = require('./src/fetchDeviceProfileData').getDeviceProfileData;
var pakerElevateGatewayData = require('./src/fetchPakerElevateGatewayData').getPakerElevateGatewayData;
var organizationDetails = require('./src/fetchOrganizationDetails').getOrganizationDetails;
var lastCellularConsumption = require('./src/lastCellularConsumption').getLastCellularConsumption;
var dateDifference = require('./src/dateDiff').getDateDifference;
var getGatewayData = require('./src/fetchGatewayData').getGatewayData;
var getOrgData = require('./src/fetchOrgData').getOrgData;
var getPartNumbersData = require('./src/fetchPartNumbers').getPartNumbersData;

// const pgClient  = require('pg').Client;
var uploadDataToPostgres = require('./src/uploadDataToPostgres').uploadDataToPostgres;

var shippedOrgIds = ['a09ad270-3b21-11e7-893e-f94b4bc7246b', '17ad9f98-33df-48a0-8c4f-99468e22e129'];

const iotHubHostName = configSettings.Values.IOT_HUB_HOST_NAME;
const iotHubSharedAccessKeyName = configSettings.Values.IOT_HUB_SHARED_ACCESS_KEY_NAME;
const iotHubSharedAccessKey = configSettings.Values.IOT_HUB_SHARED_ACCESS_KEY;

const cosmosEndpoint = configSettings.Values.COSMOS_ENDPOINT;
const cosmosMasterKey = configSettings.Values.COSMOS_MASTERKEY;
const cosmosDatabaseName = configSettings.Values.COSMOS_DATABASE_NAME;
const cosmosContainerName = configSettings.Values.COSMOS_CONTAINER_NAME;
const cosmosClient = cosmos.CosmosClient;
const cosmosConnectionString = `AccountEndpoint=${cosmosEndpoint};AccountKey=${cosmosMasterKey};`;
const client = new cosmosClient(cosmosConnectionString);
// https://github.com/Azure/azure-cosmos-js/blob/111fda5/src/request/StatusCodes.ts#L5
const cosmosResposeSucessStatus = [200, 201, 202];

// DeviceCustomerMapping Cosmos DB
const customerCosmosEndpoint = configSettings.Values.CUSTOMER_COSMOS_ENDPOINT;
const customerCosmosMasterKey = configSettings.Values.CUSTOMER_COSMOS_MASTERKEY;
const customerCosmosDatabaseName = configSettings.Values.CUSTOMER_COSMOS_DATABASE_NAME;
const customerCosmosContainerName = configSettings.Values.CUSTOMER_COSMOS_CONTAINER_NAME;
const customerCosmosClient = cosmos.CosmosClient;
const customerCosmosConnectionString = `AccountEndpoint=${customerCosmosEndpoint};AccountKey=${customerCosmosMasterKey};`;
const customerClient = new customerCosmosClient(customerCosmosConnectionString);

const postgresCofig = {
    host: configSettings.Values.POSTGRES_SERVER_NAME,
    user: configSettings.Values.POSTGRES_USER,
    password: configSettings.Values.POSTGRES_USER_PASS,
    database: 'postgres',
    port: 5432,
    ssl: true
};

// Storage account to get part numbers meta data
// const partNumberStorageAccountName = configSettings.Values.PARTNUMBER_STORAGE_ACCOUNT_NAME;
// const partNumberStorageAccountKey = configSettings.Values.PARTNUMBER_STORAGE_ACCOUNT_KEY;

const AZURE_URL = configSettings.Values.AZURE_URL;
const GRANT_TYPE = configSettings.Values.GRANT_TYPE;
const AZURE_RESOURCE = configSettings.Values.AZURE_RESOURCE;
const CLIENT_ID = configSettings.Values.CLIENT_ID;
const CLIENT_SECRET = configSettings.Values.CLIENT_SECRET;
const VOM_API_URL = configSettings.Values.VOM_API_URL;
const DEVICE_PROFILE_PARAMETERS = {
    azureURL: AZURE_URL, grantType: GRANT_TYPE, azureResource: AZURE_RESOURCE,
    clientID: CLIENT_ID, clientSecret: CLIENT_SECRET, vomURL: VOM_API_URL
};


const ELEVATE_API_MASTERTAG_URL = configSettings.Values.ELEVATE_API_MASTERTAG_URL;
const ELEVATE_TOKEN_API_URL = configSettings.Values.ELEVATE_API_URL;
const ELEVATE_API_URL_EMAIL = configSettings.Values.ELEVATE_API_URL_EMAIL;
const ELEVATE_API_URL_PASS = configSettings.Values.ELEVATE_API_URL_PASS;
const ELEVATE_TOKEN_API_URL_PARAMETERS = { url: ELEVATE_TOKEN_API_URL, email: ELEVATE_API_URL_EMAIL, pass: ELEVATE_API_URL_PASS };

const ELEVATE_API_ORG_URL = configSettings.Values.ELEVATE_API_ORG_URL;

// Platform v2 config
const PLATFORM_VERSION = configSettings.Values.platformVersion || "v1";
const OKTA_AUTH_URL = configSettings.Values.oktaAPIAuthUrl || "";
const OKTA_USER_ID = configSettings.Values.oktaUserId || "";
const OKTA_PASSWORD = configSettings.Values.oktaPassword || "";
const ASSETS_API = configSettings.Values.assetsAPI || "";
const PART_NUMBERS_API = configSettings.Values.partNumbersAPI || "";
const ORG_API = configSettings.Values.orgAPI || "";
const OKTA_PARAMETERS = {
    oktaUserId: OKTA_USER_ID,
    oktaPassword: OKTA_PASSWORD,
    oktaAPIAuthUrl: OKTA_AUTH_URL
}



// Gen2 Datalake to insert data
//const blobService = azure.createBlobService(`DefaultEndpointsProtocol=https;AccountName=${dataLakeAccountName};AccountKey=${dataLakeAccountKey};EndpointSuffix=core.windows.net`);

//Device Twin
const iotHubConnectionString = `HostName=${iotHubHostName};SharedAccessKeyName=${iotHubSharedAccessKeyName};SharedAccessKey=${iotHubSharedAccessKey}`;
const registry = registryAzureIotHub.fromConnectionString(iotHubConnectionString);


var deviceTwinJsonList = [];
var deviceProfiles = [];
var gatewayDetails = [];
var orgsDetails = [];
var lastCellularUsage = [];
var partNumberMetaDataArray = [];

var isATTResetDay = false;
var isCustomerResetDay = false;
var attResetDay = '19';
var customerResetDay = '01';
var contractDateDiff = undefined;
let newJobRunCounter = 0;

var debug = false;

const chunk = (arr, size) =>
    Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
        arr.slice(i * size, i * size + size)
    );

StartProcessing();

async function StartProcessing() {
    try {

        deviceTwinJsonList.length = 0;
        deviceProfiles.length = 0;
        gatewayDetails.length = 0;
        orgsDetails.length = 0;
        lastCellularUsage.length = 0;
        partNumberMetaDataArray.length = 0;
        counter = 0;
        customerCounter = 0;
        newJobRunCounter = 0;

        // Get date time at beginning of service for jobRunDateStamp, jobRunTimeStamp
        let today = new Date();
        let timestamp = today.toISOString();

        let dd = String(today.getDate()).padStart(2, '0');
        let mm = String(today.getMonth() + 1).padStart(2, '0');
        let yyyy = today.getFullYear();

        let todayDate = yyyy + '-' + mm + '-' + dd;

        let serviceRunDateTime = { today: today, timestamp: timestamp, todayDate: todayDate };
        //
        if (dd == attResetDay)
            isATTResetDay = true;
        else if (dd == customerResetDay)
            isCustomerResetDay = true;
        else {
            isATTResetDay = false;
            isCustomerResetDay = false;
        }

        // const postgresConfig = {
        //     host: 'msgiot-platform-dev.postgres.database.azure.com',
        //     user: 'parkeradmin@msgiot-platform-dev',
        //     password: 'Parker@2020',
        //     database: 'postgres',
        //     port: 5432,
        //     ssl: true
        // };
        

        // const pgClientInstance = new pgClient(postgresConfig)
        
        // pgClientInstance
        //     .connect()
        //     .then(() => console.log('connected'))
        //     .catch(err => console.log('connection error', err.stack))

        // var pgConnection = await uploadDataToPostgres("test", "test");
        //                     // .then(() => console.log('test connected'))
        //                     // .catch(err => console.log('test connection error', err.stack))

        // if(pgConnection){
        //     console.log(pgConnection);
        // }
        // else{
        //     console.log("async");
        // }

        lastCellularUsage = await lastCellularConsumption(client, cosmosDatabaseName, cosmosContainerName, serviceRunDateTime);
        console.log(`lastCellularUsage length:${lastCellularUsage.length}`);
        if(lastCellularUsage.length > 0){
            newJobRunCounter = lastCellularUsage[0].jobRunCounter + 1;
        }
       

        deviceProfiles = await deviceProfileData(DEVICE_PROFILE_PARAMETERS);
        console.log(`deviceProfiles length:${deviceProfiles.length}`);
              
        if (deviceProfiles.length > 0) {
            let vomDeviceIDs = deviceProfiles.map(m => m.deviceId);
            let slicedDeviceIDs = chunk(vomDeviceIDs, 500);
            deviceTwinJsonList = await deviceTwinData(registry, slicedDeviceIDs);
        }
        console.log(`deviceTwinJsonList length:${deviceTwinJsonList.length}`);

        if(PLATFORM_VERSION == "v1"){
            gatewayDetails = await pakerElevateGatewayData(ELEVATE_API_MASTERTAG_URL, ELEVATE_TOKEN_API_URL_PARAMETERS);
            orgsDetails = await organizationDetails(ELEVATE_API_ORG_URL, ELEVATE_TOKEN_API_URL_PARAMETERS);
        }            
        else if(PLATFORM_VERSION == "v2"){
            gatewayDetails = await getGatewayData(OKTA_PARAMETERS, ASSETS_API);
            orgsDetails = await getOrgData(OKTA_PARAMETERS, ORG_API);
        }          
        
        console.log(`gatewayDetails length:${gatewayDetails.length}`);       
        console.log(`orgsDetails length:${orgsDetails.length}`);

        // Read part number from storage table => obsolete 
        // partNumberMetaDataArray = await partNumberMetaData(partNumberStorageAccountName, partNumberStorageAccountKey);
        // console.log(`partNumberMetaDataArray length:${partNumberMetaDataArray.length}`);

        partNumberMetaDataArray = await getPartNumbersData(OKTA_PARAMETERS, PART_NUMBERS_API);
        console.log(`partNumberMetaDataArray length:${partNumberMetaDataArray.length}`);
        

        if (partNumberMetaDataArray.length > 0 && deviceTwinJsonList.length > 0 && deviceProfiles.length > 0
            && gatewayDetails.length > 0 && orgsDetails.length > 0) {
            await processDeviceData(serviceRunDateTime, deviceProfiles);
            //await processDeviceCustomerMapping(serviceRunDateTime);
        }
        else {
            throw "Can not proceed further, missing required data."
        }
    }
    catch (error) {
        console.log(error);
    }
}

// module.exports = async function (console, myTimer) {    
//     try {

//         azureToken = undefined;
//         counter = 0;
//         elevateApiToken = undefined;
//         consolidatedMasterTagJson = '';

//         await GetDeviceTwinData(console);        

//     }catch(error) {
//         console.log(error);
//     }   

// };

// Process device profile api data to extract customer name for each device and insert into cosmos
async function processDeviceCustomerMapping(serviceRunDateTime) {
    console.log(`processDeviceCustomerMapping`);

    try {
        let customerTemplate;

        for (let i = 0; i < deviceProfiles.length; i++) {

            const customerTemplateInit = fs.readFileSync('customerTemplate.json', 'utf8');
            customerTemplate = Object.assign({}, JSON.parse(customerTemplateInit));

            // update customer template and insert into cosmos
            customerTemplate.masterTag = deviceProfiles[i].deviceId;
            customerTemplate.customerNumber = deviceProfiles[i].customerNumber ? deviceProfiles[i].customerNumber : '';
            customerTemplate.customerName = deviceProfiles[i].customerName ? deviceProfiles[i].customerName : '';
            customerTemplate.jobRunDateStamp = serviceRunDateTime.todayDate;
            customerTemplate.jobRunTimeStamp = serviceRunDateTime.timestamp;
            let customerId = customerTemplate.masterTag + '|' + serviceRunDateTime.todayDate;
            customerTemplate.id = customerId;
            console.log(`customerTemplate id: ${customerId}`);

            // cutomerCosmosRespose = await uploadDataToCosmos(customerTemplate, customerClient, customerCosmosDatabaseName, customerCosmosContainerName);
            // if (cosmosResposeSucessStatus.includes(cutomerCosmosRespose.statusCode)) {
            //     customerCounter += 1;
            //     console.log(`customerCounter: ${customerCounter}; id: ${customerId}`);
            // }
            // else {
            //     console.log(`Failed to insert/update customer document into cosmos with status code: ${cutomerCosmosRespose.statusCode}`);
            // }
        }
    }
    catch (error) {
        console.log(error);
    }
}

async function processDeviceData(serviceRunDateTime) {
    console.log(`processDeviceData`);

    try {
        let newTemplate;

        for (let i = 0; i < deviceProfiles.length; i++) {

            const initialTemplate = fs.readFileSync('template.json', 'utf8');
            newTemplate = Object.assign({}, JSON.parse(initialTemplate));

            let deviceId = deviceProfiles[i].deviceId;
            try {

                console.log(`Processing device: ${deviceId}`);
                newTemplate.mtag = deviceId;
                //newTemplate.simId = deviceProfiles[i].iccid ? deviceProfiles[i].iccid : '';

                newTemplate.assets.ptsID = deviceProfiles[i].ptsID ? deviceProfiles[i].ptsID : '';
                //newTemplate.simDataUsage = deviceProfiles[i].simDataUsage ? deviceProfiles[i].simDataUsage : '';

                newTemplate.assets.customerName = deviceProfiles[i].customerName ? deviceProfiles[i].customerName : '';
                newTemplate.assets.customerNumber = deviceProfiles[i].customerNumber ? deviceProfiles[i].customerNumber : '';

                let shippedDate = deviceProfiles[i].shippedDate ? deviceProfiles[i].shippedDate : '';
                newTemplate.assets.shippedDate = shippedDate;

                // contractDateDiff
                contractDateDiff = undefined;
                if (shippedDate !== '') {
                    contractDateDiff = dateDifference(new Date(shippedDate), new Date(serviceRunDateTime.today));
                    newTemplate.assets.contractDateDiff.days = contractDateDiff.days;
                    newTemplate.assets.contractDateDiff.weeks = contractDateDiff.weeks;
                    newTemplate.assets.contractDateDiff.months = contractDateDiff.months;
                    newTemplate.assets.contractDateDiff.years = contractDateDiff.years;
                }


                let partNumber = deviceProfiles[i].partNumber ? deviceProfiles[i].partNumber : '';
                let latestPartNumber = deviceProfiles[i].latestPartNumber ? deviceProfiles[i].latestPartNumber : '';

                if (partNumber.includes('ECD')) {
                    partNumber = partNumber.replace(/ECD/g, '');
                }                
                newTemplate.assets.partNumber = partNumber;

                if (latestPartNumber.includes('ECD')) {
                    latestPartNumber = latestPartNumber.replace(/ECD/g, '');
                }
                newTemplate.assets.latestPartNumber = latestPartNumber;

                // cellular data
                let deviceProfileData = deviceProfiles[i];
                newTemplate = processCellularData(deviceId, deviceProfileData, newTemplate);

                //console.log(newTemplate);           

                newTemplate = processGatewayData(deviceId, newTemplate);

                newTemplate = processTwinData(deviceId, newTemplate, serviceRunDateTime);

                ////console.log("newTemplate",newTemplate);
                ////uploadDataToLake(deviceId,newTemplate,console)
                ////await uploadDataToCosmos(newTemplate);

                var pgConnection = await uploadDataToPostgres(deviceId, newTemplate, postgresCofig);

                newTemplate.jobRunDateStamp = serviceRunDateTime.todayDate;
                newTemplate.jobRunTimeStamp = serviceRunDateTime.timestamp;
                let id = newTemplate.mtag + '|' + newJobRunCounter + '|' + serviceRunDateTime.todayDate;
                newTemplate.id = id;
                newTemplate.jobRunCounter = newJobRunCounter;

                console.log(`newTemplate id: ${id}`);

                // cosmosRespose = await uploadDataToCosmos(newTemplate, client, cosmosDatabaseName, cosmosContainerName);
                // if (cosmosResposeSucessStatus.includes(cosmosRespose.statusCode)) {
                //     counter += 1;
                //     console.log(`counter: ${counter}; id: ${id}`);
                // }
                // else {
                //     console.log(`Failed to insert/update document into cosmos with status code: ${cosmosRespose.statusCode}`);
                // }

            }
            catch (error) {
                console.log(`Failed while processing device: ${deviceId}; with error: ${error.message}`);
            }

        }
        //updateJobRunCounter();

    } catch (error) {
        console.log(error);
    }


}

function processCellularData(deviceId, deviceProfileData, newTemplate) {

    let partNumber = newTemplate.assets.latestPartNumber;

    newTemplate.cellularVom.iccid = deviceProfileData.iccid ? deviceProfileData.iccid : '';
    newTemplate.cellularVom.currDataUsage = deviceProfileData.currDataUsage ? deviceProfileData.currDataUsage : '';

    let currDataUsageInBytes = parseInt(deviceProfileData.currDataUsage ? deviceProfileData.currDataUsage : 0);
    let currDataUsageIntoMB = (currDataUsageInBytes / (1024 * 1024)).toFixed(3);
    newTemplate.cellularVom.currDataUsageDisplay = currDataUsageIntoMB ? currDataUsageIntoMB : '';

    //newTemplate.cellularVom.currDataUsageDisplay = deviceProfiles[i].currDataUsageDisplay ? deviceProfiles[i].currDataUsageDisplay : '';
    newTemplate.cellularVom.currDataUsageSince = deviceProfileData.currDataUsageSince ? deviceProfileData.currDataUsageSince : '';
    newTemplate.cellularVom.currDataUsageSinceISO = deviceProfileData.currDataUsageSinceISO ? deviceProfileData.currDataUsageSinceISO : '';
    newTemplate.cellularVom.currStatus = deviceProfileData.currStatus ? deviceProfileData.currStatus : '';
    newTemplate.cellularVom.currRatePlan = deviceProfileData.currRatePlan ? deviceProfileData.currRatePlan : '';
    newTemplate.cellularVom.currCommunicationPlan = deviceProfileData.currCommunicationPlan ? deviceProfileData.currCommunicationPlan : '';

    let lastCellularConsumptionOfDevice = lastCellularUsage.filter(m => m.mtag == deviceId);
    if (lastCellularConsumptionOfDevice !== undefined && lastCellularConsumptionOfDevice.length > 0) {

        let lastCurrDataUsageBytes = parseInt(lastCellularConsumptionOfDevice[0].cellularVom.currDataUsage ?
            lastCellularConsumptionOfDevice[0].cellularVom.currDataUsage : 0)

        //First run
        // let custDataUsageBytes = currDataUsageInBytes - lastCurrDataUsageBytes;
        // let custDataUsageIntoMB = (custDataUsageBytes / (1024 * 1024)).toFixed(3);
        //

        //Next run
        let lastCustDataUsageBytes = parseInt(lastCellularConsumptionOfDevice[0].cellularCustomer.currDataUsage ?
            lastCellularConsumptionOfDevice[0].cellularCustomer.currDataUsage : 0);
        let custPerDayUsageBytes = 0;
        if (isATTResetDay) {
            custPerDayUsageBytes = currDataUsageInBytes;
        }
        else {
            custPerDayUsageBytes = currDataUsageInBytes - lastCurrDataUsageBytes;
        }

        let custDataUsageBytes = 0;
        if (isCustomerResetDay) {
            custDataUsageBytes = custPerDayUsageBytes;
        }
        else {
            custDataUsageBytes = custPerDayUsageBytes + lastCustDataUsageBytes;
        }

        let custDataUsageIntoMB = (custDataUsageBytes / (1024 * 1024)).toFixed(3);
        newTemplate.cellularCustomer.currPerDayUsage = custPerDayUsageBytes;
        //

        newTemplate.cellularCustomer.currDataUsage = custDataUsageBytes;
        newTemplate.cellularCustomer.currDataUsageDisplay = custDataUsageIntoMB;
    }
    else {
        newTemplate.cellularCustomer.currDataUsage = 0;
        newTemplate.cellularCustomer.currDataUsageDisplay = 0.00;
    }

    let technology = '';
    let custRatePlan = '';

    if (partNumberMetaDataArray.length > 0 && partNumber != '') {
        //let partNumbermetaData = partNumberMetaDataArray.filter(metaData => metaData.PartNumber == partNumber);
        let partNumbermetaData = partNumberMetaDataArray.filter(metaData => metaData.partNumber == partNumber);

        if (partNumbermetaData !== undefined && partNumbermetaData.length > 0) {
            // technology = partNumbermetaData[0].CellTech;
            // custRatePlan = partNumbermetaData[0].CustomerRatePlanMB;
            technology = partNumbermetaData[0].modemType;
            custRatePlan = partNumbermetaData[0].dataPlan.planSize;
        }

    }
    newTemplate.cellularVom.technology = technology;
    newTemplate.cellularCustomer.currRatePlan = String(custRatePlan ? custRatePlan : '');

    return newTemplate;
}

function processGatewayData(deviceId, newTemplate) {

    let getGatewayDetails; let getOrgnDetails; let gtemplate; let status; let orgPath; let templateName = '';

    //console.log("processGatewayData");

    getGatewayDetails = gatewayDetails.filter(gateway => gateway.mastertag === deviceId);

    if (getGatewayDetails !== undefined && getGatewayDetails.length > 0) {
        
        if(PLATFORM_VERSION == "v1"){
            newTemplate.platform.orgId = getGatewayDetails[0].orgID;        
            newTemplate.platform.templateId = getGatewayDetails[0].gtemplateID;            
            //gtemplate = getGatewayDetails[0].gtemplate;
            templateName = getGatewayDetails[0].gtemplate ? getGatewayDetails[0].gtemplate.name : '';  
            getOrgnDetails = orgsDetails.filter(organization => organization._id === getGatewayDetails[0].orgID);          
        }
        else(PLATFORM_VERSION == "v2")
        {
            newTemplate.platform.orgId = getGatewayDetails[0].orgId;        
            newTemplate.platform.templateId = getGatewayDetails[0].templateId;
            templateName = getGatewayDetails[0].templateName
            getOrgnDetails = orgsDetails.filter(organization => organization.orgId === getGatewayDetails[0].orgId);          
        }
        
        status = getGatewayDetails[0].status;
        newTemplate.platform.state = status;
        newTemplate.platform.assetName = getGatewayDetails[0].nickname;
        
        //console.log("getOrgnDetails", getOrgnDetails);

        if (getOrgnDetails !== undefined && getOrgnDetails.length > 0) {
            orgPath = PLATFORM_VERSION == "v1" ? getOrgnDetails[0].path : getOrgnDetails[0].pathId;
            newTemplate.platform.orgName = getOrgnDetails[0].name;
        }
        else if (newTemplate.platform.orgId == 'c6adcb40-be92-11e6-9ed6-a5bc9cb5279b') {
            newTemplate.platform.orgName = 'Parker';
            orgPath = 'c6adcb40-be92-11e6-9ed6-a5bc9cb5279b'
        }
        else {
            newTemplate.platform.orgName = '';
        }

    }
    else{
        console.log("Gateway details not available for device: " + deviceId);
    }
    
    if (templateName) {

        let shipped = false;       

        newTemplate.platform.templateName = templateName;
        if (templateName === "On Boarding" && status === "active") {
            newTemplate.gatewayStatus = "Onboarding Template";
        }
        else if (templateName !== "On Boarding" && status === "active") {
            newTemplate.gatewayStatus = "Customer Template";
        }
        else if (status === "active" || status === "whitelisted") {
            if (templateName !== "On Boarding") {
                for (i = 0; i <= shippedOrgIds.length; i++) {
                    if (orgPath !== undefined) {
                        if (orgPath.includes(shippedOrgIds[i])) {
                            shipped = true;
                            break;
                        }
                    }
                }
            }
            if (shipped) {
                newTemplate.gatewayStatus = "Total Number Shipped";
            }
        }
    }

    if (contractDateDiff !== undefined) {
        if ((contractDateDiff.days > 182) && (status == 'whitelisted' || templateName == 'On Boarding')) {
            newTemplate.assets.contractDue = "Yes";
        }
        else {
            newTemplate.assets.contractDue = "No";
        }
    }
    return newTemplate;
}

function processTwinData(deviceId, newTemplate, serviceRunDateTime) {

    let purple; let red; let orange; let cellModem; let orgID; let imageVersion = ''; let region
    //console.log("processTwinData");
    let technology = newTemplate.cellularVom.technology ? newTemplate.cellularVom.technology : '';

    let twinData = deviceTwinJsonList.filter(deviceTwin => deviceTwin.deviceId === deviceId);
    let partNumber = newTemplate.assets.latestPartNumber;   

    if (partNumberMetaDataArray.length > 0 && partNumber != '') {
        //let partNumberMetaData = partNumberMetaDataArray.filter(metaData => metaData.PartNumber == partNumber);
        let partNumberMetaData = partNumberMetaDataArray.filter(metaData => metaData.partNumber == partNumber);
        if(partNumberMetaData.length > 0)
            //region = partNumberMetaData[0].Region ? partNumberMetaData[0].Region : '';
            region = partNumberMetaData[0].region ? partNumberMetaData[0].region : '';
    }

    if (twinData !== undefined && twinData.length > 0) {
        //newTemplate.mtag = deviceId;

        newTemplate.gwDeviceTwin.lastActivityTime = twinData[0].lastActivityTime ? twinData[0].lastActivityTime : '';

        if (twinData[0].lastActivityTime) {
            let lastActivityTimeConverted = new Date(twinData[0].lastActivityTime);
            //let todayDate = new Date();
            let todayDate = serviceRunDateTime.today;
            const diffTime = Math.abs(lastActivityTimeConverted - todayDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (twinData[0].connectionState === "Disconnected" && diffDays > 7) {
                purple = true;
            }

            let properties = twinData[0].properties;
            let reported = properties.reported;
            //console.log("reported",reported);
            if (reported !== undefined) {
                let softwareVersions = reported.softwareVersions;
                if (softwareVersions !== undefined) {
                    let hedLedVersion = softwareVersions['HED-LED'];
                    newTemplate.gwDeviceTwin.softwareVersions["HED-LED"] = hedLedVersion ? hedLedVersion : '';
                    let iQanConnectVersion = softwareVersions['iqan_connect'];
                    newTemplate.gwDeviceTwin.softwareVersions["iqan_connect"] = iQanConnectVersion ? iQanConnectVersion : '';
                    let loggerAzureVersion = softwareVersions['logger_azure'];
                    newTemplate.gwDeviceTwin.softwareVersions["logger_azure"] = loggerAzureVersion ? loggerAzureVersion : '';
                    let miqupdaterVersion = softwareVersions.miqupdater;
                    newTemplate.gwDeviceTwin.softwareVersions["miqupdater"] = miqupdaterVersion ? miqupdaterVersion : '';
                    (!miqupdaterVersion && miqupdaterVersion === "") ? red = true : false;
                    let wifiClientVersion = softwareVersions['wifi_client'];
                    newTemplate.gwDeviceTwin.softwareVersions["wifi_client"] = wifiClientVersion ? wifiClientVersion : '';
                    let wifiMuleVersion = softwareVersions['wifi_mule'];
                    newTemplate.gwDeviceTwin.softwareVersions["wifi_mule"] = wifiMuleVersion ? wifiMuleVersion : '';
                    let offline_count = softwareVersions['offline_count'];
                    newTemplate.gwDeviceTwin.softwareVersions["offline_count"] = offline_count ? offline_count : '';
                    let gmq = softwareVersions.gmq;
                    newTemplate.gwDeviceTwin.softwareVersions["gmq"] = gmq ? gmq : '';
                    let gweDeviceClient = softwareVersions['gwe_device-client'];
                    newTemplate.gwDeviceTwin.softwareVersions["gwe_device-client"] = gweDeviceClient ? gweDeviceClient : '';
                    let gweGatewayEngine = softwareVersions['gwe_gateway-engine'];
                    newTemplate.gwDeviceTwin.softwareVersions["gwe_gateway-engine"] = gweGatewayEngine ? gweGatewayEngine : '';
                    let iqanconnect = softwareVersions.iqanconnect;
                    newTemplate.gwDeviceTwin.softwareVersions.iqanconnect = iqanconnect ? iqanconnect : '';
                    let loggerGwe = softwareVersions['logger_gwe'];
                    newTemplate.gwDeviceTwin.softwareVersions["logger_gwe"] = loggerGwe ? loggerGwe : '';
                    let mule = softwareVersions.mule;
                    newTemplate.gwDeviceTwin.softwareVersions["mule"] = mule ? mule : '';
                    let muleInstalled = softwareVersions['mule_installed'];
                    newTemplate.gwDeviceTwin.softwareVersions["muleInstalled"] = muleInstalled ? muleInstalled : '';
                    let muleLogger = softwareVersions['mule_logger'];
                    newTemplate.gwDeviceTwin.softwareVersions["mule_logger"] = muleLogger ? muleLogger : '';
                    let localadmin = softwareVersions.localadmin;
                    newTemplate.gwDeviceTwin.softwareVersions["localadmin"] = localadmin ? localadmin : '';
                    let comm1 = softwareVersions.comm1;
                    newTemplate.gwDeviceTwin.softwareVersions["comm1"] = comm1 ? comm1 : '';
                    let comm0 = softwareVersions.comm0;
                    newTemplate.gwDeviceTwin.softwareVersions["comm0"] = comm0 ? comm0 : '';
                    let wifiConnect = softwareVersions['wifi_connect'];
                    newTemplate.gwDeviceTwin.softwareVersions["wifi_connect"] = wifiConnect ? wifiConnect : '';
                    let fifoAndDatapointDeleteFix = softwareVersions['fifo_and_datapoint_delete_fix'];
                    newTemplate.gwDeviceTwin.softwareVersions["fifo_and_datapoint_delete_fix"] = fifoAndDatapointDeleteFix ? fifoAndDatapointDeleteFix : '';
                    cellModem = softwareVersions['cell_modem'];
                    newTemplate.gwDeviceTwin.softwareVersions["cell_modem"] = cellModem ? cellModem : '';
                }
                // console.log("metadata",properties.desired.$metadata);
                //console.log("metadata.jobs",properties.desired.$metadata.jobs);
                let metaDataJobs = properties.desired.$metadata.jobs;
                let jobsDesired = properties.desired.jobs;

                if (metaDataJobs !== undefined) {
                    let arrayData = [];
                    for (key in metaDataJobs) {
                        if (metaDataJobs[key].$lastUpdated !== undefined) {
                            arrayData.push({
                                jobId: key, date: metaDataJobs[key].$lastUpdated
                            });
                        }
                    }

                    let sorteddata = arrayData.sort(function (a, b) {
                        return new Date(b.date) - new Date(a.date)
                    }).slice(0, 5);
                    // console.log("sorteddata", sorteddata);

                    for (let i = 0; i < sorteddata.length; i++) {
                        let jobId; let jobType; let jobInfo; let jobSchDateTime; let jobStatus;
                        let jobStatusDateTime; let jobPackage; let version; let file; let httpBase;

                        jobSchDateTime = sorteddata[i].date;
                        if (jobsDesired !== undefined) {
                            for (key in jobsDesired) {
                                let jobID = key;
                                if (sorteddata[i].jobId === jobID) {
                                    jobId = jobID ? jobID : '';

                                    let jobObject;

                                    if (jobsDesired[key] !== "") {
                                        jobObject = JSON.parse(jobsDesired[key]);
                                        jobType = jobObject.type ? jobObject.type : '';
                                        jobInfo = jobObject.job ? jobObject.job : '';
                                    }
                                    else
                                        jobType = "";

                                    if (jobInfo !== undefined) {
                                        file = jobInfo.file ? jobInfo.file : '';
                                        jobPackage = jobInfo.package ? jobInfo.package : '';
                                        version = jobInfo.version ? jobInfo.version : '';
                                        httpBase = jobInfo.HTTPBase ? jobInfo.HTTPBase : '';
                                    }
                                    else {
                                        file = "";
                                        jobPackage = "";
                                        version = "";
                                        httpBase = "";
                                    }

                                    let jobs = reported.jobs;
                                    if (jobs !== undefined) {
                                        let succeded = 0; let failure = 0;
                                        for (key in jobs) {
                                            if (key === jobID) {
                                                let jobValue = jobs[key];
                                                //console.log("jobValue:", jobValue);
                                                if (jobValue.includes('SUCCEEDED')) {
                                                    jobStatus = "Succeeded";
                                                    //succeded +=1;
                                                    //continue;
                                                }
                                                else if (jobValue.includes('FAILED')) {
                                                    jobStatus = "Failed";
                                                    //failure +=1;
                                                    //continue;
                                                }
                                                else {
                                                    jobStatus = "Pending";
                                                }
                                            }
                                        }
                                        //newTemplate.Status = `succeeded: ${succeded}:failure: ${failure}`;
                                    }
                                    else
                                        jobStatus = "";

                                    let reportedJobs = reported.$metadata.jobs;
                                    if (reportedJobs !== undefined) {
                                        for (key in reportedJobs) {
                                            if (key === jobID) {
                                                jobStatusDateTime = reportedJobs[key].$lastUpdated ? reportedJobs[key].$lastUpdated : '';
                                                //console.log("jobStatusDateTime :", reportedJobs[key].$lastUpdated) ;
                                            }
                                        }
                                    }
                                    else
                                        jobStatusDateTime = "";
                                }
                            }

                        }
                        if (i == 0) {
                            newTemplate.gwDeviceTwin.jobs.job1["jobID"] = jobId;
                            newTemplate.gwDeviceTwin.jobs.job1["jobType"] = jobType;
                            newTemplate.gwDeviceTwin.jobs.job1.jobInfo["package"] = jobPackage;
                            newTemplate.gwDeviceTwin.jobs.job1.jobInfo["version"] = version;
                            newTemplate.gwDeviceTwin.jobs.job1.jobInfo["file"] = file;
                            newTemplate.gwDeviceTwin.jobs.job1.jobInfo["HTTPBase"] = httpBase;
                            newTemplate.gwDeviceTwin.jobs.job1["jobSchDateTime"] = jobSchDateTime
                            newTemplate.gwDeviceTwin.jobs.job1["jobStatus"] = jobStatus;
                            newTemplate.gwDeviceTwin.jobs.job1["jobStatusDateTime"] = jobStatusDateTime;
                        }
                        if (i == 1) {
                            newTemplate.gwDeviceTwin.jobs.job2["jobID"] = jobId;
                            newTemplate.gwDeviceTwin.jobs.job2["jobType"] = jobType;
                            newTemplate.gwDeviceTwin.jobs.job2.jobInfo["package"] = jobPackage;
                            newTemplate.gwDeviceTwin.jobs.job2.jobInfo["version"] = version;
                            newTemplate.gwDeviceTwin.jobs.job2.jobInfo["file"] = file;
                            newTemplate.gwDeviceTwin.jobs.job2.jobInfo["HTTPBase"] = httpBase;
                            newTemplate.gwDeviceTwin.jobs.job2["jobSchDateTime"] = jobSchDateTime
                            newTemplate.gwDeviceTwin.jobs.job2["jobStatus"] = jobStatus;
                            newTemplate.gwDeviceTwin.jobs.job2["jobStatusDateTime"] = jobStatusDateTime;
                        }
                        if (i == 2) {
                            newTemplate.gwDeviceTwin.jobs.job3["jobID"] = jobId;
                            newTemplate.gwDeviceTwin.jobs.job3["jobType"] = jobType;
                            newTemplate.gwDeviceTwin.jobs.job3.jobInfo["package"] = jobPackage;
                            newTemplate.gwDeviceTwin.jobs.job3.jobInfo["version"] = version;
                            newTemplate.gwDeviceTwin.jobs.job3.jobInfo["file"] = file;
                            newTemplate.gwDeviceTwin.jobs.job3.jobInfo["HTTPBase"] = httpBase;
                            newTemplate.gwDeviceTwin.jobs.job3["jobSchDateTime"] = jobSchDateTime
                            newTemplate.gwDeviceTwin.jobs.job3["jobStatus"] = jobStatus;
                            newTemplate.gwDeviceTwin.jobs.job3["jobStatusDateTime"] = jobStatusDateTime;
                        }
                        if (i == 3) {
                            newTemplate.gwDeviceTwin.jobs.job4["jobID"] = jobId;
                            newTemplate.gwDeviceTwin.jobs.job4["jobType"] = jobType;
                            newTemplate.gwDeviceTwin.jobs.job4.jobInfo["package"] = jobPackage;
                            newTemplate.gwDeviceTwin.jobs.job4.jobInfo["version"] = version;
                            newTemplate.gwDeviceTwin.jobs.job4.jobInfo["file"] = file;
                            newTemplate.gwDeviceTwin.jobs.job4.jobInfo["HTTPBase"] = httpBase;
                            newTemplate.gwDeviceTwin.jobs.job4["jobSchDateTime"] = jobSchDateTime
                            newTemplate.gwDeviceTwin.jobs.job4["jobStatus"] = jobStatus;
                            newTemplate.gwDeviceTwin.jobs.job4["jobStatusDateTime"] = jobStatusDateTime;
                        }
                        if (i == 4) {
                            newTemplate.gwDeviceTwin.jobs.job5["jobID"] = jobId;
                            newTemplate.gwDeviceTwin.jobs.job5["jobType"] = jobType;
                            newTemplate.gwDeviceTwin.jobs.job5.jobInfo["package"] = jobPackage;
                            newTemplate.gwDeviceTwin.jobs.job5.jobInfo["version"] = version;
                            newTemplate.gwDeviceTwin.jobs.job5.jobInfo["file"] = file;
                            newTemplate.gwDeviceTwin.jobs.job5.jobInfo["HTTPBase"] = httpBase;
                            newTemplate.gwDeviceTwin.jobs.job5["jobSchDateTime"] = jobSchDateTime
                            newTemplate.gwDeviceTwin.jobs.job5["jobStatus"] = jobStatus;
                            newTemplate.gwDeviceTwin.jobs.job5["jobStatusDateTime"] = jobStatusDateTime;
                        }
                    }
                }
                //console.log("jobsDataList: ", jobsDataList);
                let diagnostics = reported.diagnostics;
                if (diagnostics !== undefined) {
                    let supervisorctlStatus = diagnostics.supervisorctl_status;
                    newTemplate.gwDeviceTwin.supervisorCtlStatus = supervisorctlStatus ? supervisorctlStatus : '';
                    let unameA = diagnostics['uname_-a'];
                    newTemplate.gwDeviceTwin.factoryBuildVersion = unameA ? unameA : '';

                    if (unameA !== undefined) {
                        var arr = unameA.split(' ');

                        for (i = 0; i < arr.length; i++) {
                            if (i === 5) {
                                imageVersion = arr[i];
                            }
                            if (i === 6) {
                                imageVersion = imageVersion + arr[i];
                            }
                            if (i === 9) {
                                imageVersion = imageVersion + '-' + arr[i];
                            }
                        }
                        newTemplate.gwDeviceTwin.softwareVersions.imageVersion = imageVersion ? imageVersion : '';
                    }

                    let internalStats = JSON.parse(diagnostics['[internal_stats]']);
                    if (internalStats !== undefined) {
                        let gps = internalStats.gps;
                        if (gps !== undefined) {
                            let gpsMode = gps.mode;
                            newTemplate.gwDeviceTwin.gpsMode = gpsMode ? gpsMode : '';
                            let gpsSatsInView = gps['sats_in_view'];
                            newTemplate.gwDeviceTwin.gpsSatsInView = gpsSatsInView ? gpsSatsInView : '';
                            let gpsSatsUsed = gps['sats_used'];
                            newTemplate.gwDeviceTwin.gpsSatsUsed = gpsSatsUsed ? gpsSatsUsed : '';
                        }
                        let IQAN = internalStats.IQAN;
                        if (IQAN !== undefined) {
                            IqanKey = IQAN.Key;
                            newTemplate.gwDeviceTwin.iqanConnectKey = IqanKey ? IqanKey : '';
                        }
                        let can = internalStats.can;
                        if (can !== undefined) {
                            let can0_packets = can.can0_packets;
                            newTemplate.gwDeviceTwin.can0Packets = can0_packets ? can0_packets : '';
                            let can1_packets = can.can1_packets;
                            newTemplate.gwDeviceTwin.can1Packets = can1_packets ? can1_packets : '';
                        }
                        let signalM = internalStats.modem;
                        if (signalM !== undefined) {
                            let signalStrength = signalM.signal;
                            newTemplate.gwDeviceTwin.signalStrength = signalStrength ? signalStrength : '';
                        }

                    }
                    let df = diagnostics.df;
                    if (df !== undefined) {
                        let dfArray = df.split('\n');
                        let storageElementsToSearch = ['root', 'tmpfs', 'mmcblk1p5', 'mmcblk1p6'];
                        for (let i = 0; i < storageElementsToSearch.length; i++) {
                            let filteredDF = dfArray
                                .filter((element) => element !== '' && element.includes(storageElementsToSearch[i]))
                                .reduce((accumulator, currentValue) => accumulator + " " + currentValue, '');
                            newTemplate.gwDeviceTwin.availableStorageSpace[storageElementsToSearch[i]] = filteredDF ? filteredDF : '';
                        }
                    }
                    let free = diagnostics.free;
                    if (free !== undefined) {
                        if (free.length > 0) {
                            let freeSplittedArray = free.split('\n');
                            if (freeSplittedArray.length > 1) {
                                let freeArraySecondArray = freeSplittedArray[1].split(' ');
                                if (freeArraySecondArray.length > 2) {
                                    let totalSpace = freeArraySecondArray[1];
                                    let usedSpace = freeArraySecondArray[2];
                                    let freeSpace = freeArraySecondArray[3];
                                    newTemplate.gwDeviceTwin.memStat = freeSpace ? freeSpace : '';
                                    let usedSpaceCalc = (usedSpace / totalSpace) * 100;
                                    if (usedSpaceCalc > 75) {
                                        orange = true;
                                    }
                                }
                            }
                        }
                    }

                }

            }

            if (cellModem === undefined) {
                if (imageVersion === 'May13-2020') {
                    newTemplate.gwDeviceTwin.softwareVersions.bspVersion = '1.2.13';
                    switch (region) {
                        case "Europe":
                            newTemplate.gwDeviceTwin.softwareVersions["cell_modem"] = 'LARA-R211:30.49';
                            break;
                        case "North America":
                            newTemplate.gwDeviceTwin.softwareVersions["cell_modem"] = 'TOBY-R200:30.33';
                            break;
                    }
                }
                else if (imageVersion === 'Dec27-2019') {
                    newTemplate.gwDeviceTwin.softwareVersions.bspVersion = '1.2.11';
                }
                else if (imageVersion === 'Oct22-2017') {
                    newTemplate.gwDeviceTwin.softwareVersions.bspVersion = '1.0.7';
                }
                else if (imageVersion === 'Dec12-2017') {
                    newTemplate.gwDeviceTwin.softwareVersions.bspVersion = '1.0.12';
                }
                else if (imageVersion === 'Jul10-2018' || imageVersion === 'Jan16-2019'
                    || imageVersion === 'Sep23-2019' || technology == '3G') {
                    newTemplate.gwDeviceTwin.softwareVersions.bspVersion = '1.0.14';
                }
                else {
                    newTemplate.gwDeviceTwin.softwareVersions.bspVersion = 'UNKNOWN';
                }
            }
            else {
                let tmpCellModem = cellModem.toUpperCase();
                if (tmpCellModem.includes('TOBY-R200:30.33') || tmpCellModem.includes('READY_FOR_CELL_MODEM_UPGRADE')) {
                    newTemplate.gwDeviceTwin.softwareVersions.bspVersion = '1.0.14V2';
                }
                else if (tmpCellModem.includes('LISA-U230:22.40') || tmpCellModem.includes('TOBY-R200:30.31') || technology == '3G') {
                    newTemplate.gwDeviceTwin.softwareVersions.bspVersion = '1.0.14';
                }
                else {
                    newTemplate.gwDeviceTwin.softwareVersions.bspVersion = 'Error' + ' ' + cellModem;
                }
            }


            if (purple) {
                newTemplate.operationalType = 'Not Reporting Data > 7 Days';
            } else if (red) {
                newTemplate.operationalType = 'Fatal Errors';
            } else if (orange) {
                newTemplate.operationalType = 'Potential Errors';
            }
            else {
                newTemplate.operationalType = 'Good Condition';
            }
        }

        //var result = await uploadDataToPostgres(deviceId, newTemplate);

    }
    else{
        console.log("Device twin data not available for device: " + deviceId);
    }
     
    return newTemplate;

}

// function updateJobRunCounter() {
//     //var initTemplate = JSON.parse(initialTemplate);
//     try {

//         let initTemplate = JSON.parse(fs.readFileSync('template.json', 'utf8'));
//         let jobRunCounter = parseInt(initTemplate.jobRunCounter)
//         console.log(`jobRunCounter Before: ${jobRunCounter}`);
//         //jobRunCounter = 0;

//         initTemplate.jobRunCounter = jobRunCounter + 1;

//         console.log(`jobRunCounter After: ${initTemplate.jobRunCounter}`);
//         fs.writeFileSync('template.json', JSON.stringify(initTemplate));
//     }
//     catch (error) {
//         console.log(`$Error while updating JobRunCounter to template: ${error.message}`);
//     }
// }


// getDeviceProfile = (azureToken, assetId) => {

//     return new Promise((resolve, reject) => {
//         var deviceProfileApi = {
//             method: 'GET',
//             url: `${configSettings.Values.DEVICE_PROFILE_URL}${assetId}`,
//             headers: { 'Content-type': 'application/json', 'authorization': `bearer ${azureToken}` }
//         }
//         rp(deviceProfileApi)
//             .then((deviceProfileResponse) => {
//                 return resolve(deviceProfileResponse);
//             })
//             .catch(error => reject(error));
//     });
// }

// async function uploadDataToCosmos(newTemplate) {
//     try {
//         let finalTemplate = newTemplate

//         finalTemplate.jobRunDateStamp = todayDate;
//         finalTemplate.jobRunTimeStamp = timestamp;

//         let id = finalTemplate.mtag + '|' + finalTemplate.jobRunCounter + '|' + todayDate;
//         //console.log(`id: ${id}`);
//         finalTemplate.id = id;

//         counter += 1;
//         console.log(`counter: ${counter}; id: ${id}`);

//         //await client.database(cosmosDatabaseName).container(cosmosContainerName).items.upsert(finalTemplate);
//     }
//     catch (error) {
//         console.log(`Error while inserting data into cosmos: ${error.message}`);
//     }

// }

// function uploadDataToLake(assetId, newTemplate) {
//     let today = new Date();
//     let todayIsoTime = today.toISOString();
//     //newTemplate.createdDate=todayIsoTime;

//     var dd = String(today.getDate()).padStart(2, '0');
//     var mm = String(today.getMonth() + 1).padStart(2, '0');
//     var yyyy = today.getFullYear();

//     today = yyyy + '-' + mm + '-' + dd;
//     var id = newTemplate.mtag + '|' + newTemplate.jobRunCounter + '|' + today;
//     newTemplate.id = id;

//     newTemplate.jobRunDateStamp = today;
//     newTemplate.jobRunTimeStamp = todayIsoTime;

//     folderName = yyyy + '-' + mm + '-' + dd + '-RT';
//     //console.log(`Folder Name:${folderName}`);

//     counter += 1;
//     console.log(`counter: ${counter}`);

//     new Promise((resolve, reject) => {
//         blobService.createBlockBlobFromText(dataLakeStorageName, `${folderName}/${assetId}.json`, JSON.stringify(newTemplate), (error, result, response) => {
//             if (!error) {
//                 // file uploaded                
//                 return resolve(`${assetId} data uploaded on date ${today}`);
//             }
//             if (error) {
//                 return reject('error while uploading' + error);
//             }
//         });
//     });
// }
