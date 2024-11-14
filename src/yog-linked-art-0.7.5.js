import Command from '#src/Command.js';
import crypto from 'crypto';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { createInterface } from 'readline';
import yaml from 'js-yaml';

// Define concepts, paths, and immutables
const primaryNameUris = ['https://lux.collections.yale.edu/data/concept/f7ef5bb4-e7fb-443d-9c6b-371a23e717ec', 'http://vocab.getty.edu/aat/300404670'];
const periodUris = ['https://lux.collections.yale.edu/data/concept/c1cb739d-db1e-4e93-bb03-64f135e0b4cb', 'http://vocab.getty.edu/aat/300081446'];
const objectTypeUris = ['https://lux.collections.yale.edu/data/concept/4ea65dc4-76bc-45b7-b54c-a1ca4783d4e2', 'http://vocab.getty.edu/aat/300435443'];
const accessionUris = ['https://lux.collections.yale.edu/data/concept/3d9696be-0b9a-4a3d-b380-7584fbf96ac7', 'http://vocab.getty.edu/aat/300312355'];
const enUris = ['https://lux.collections.yale.edu/data/concept/dfa53b96-4eda-4c9a-b091-10008a726c38', 'http://vocab.getty.edu/aat/300388277'];
const creditLineUris = ['https://lux.collections.yale.edu/data/concept/7c0ba119-47cb-4ade-8aa3-32a1e66c8ca9', 'http://vocab.getty.edu/aat/300435418'];
const webPageUris = ['https://lux.collections.yale.edu/data/concept/2eca07bd-be42-4ef5-9ec5-87c1bbfe639d', 'http://vocab.getty.edu/aat/300264578'];
const thumbnailUris = ['https://lux.collections.yale.edu/data/concept/b28a48ef-4d40-44d1-81c9-27f0411b030b', 'http://vocab.getty.edu/aat/300215302'];
const descriptionUris = ['https://lux.collections.yale.edu/data/concept/b9d84f17-662e-46ef-ab8b-7499717f8337', 'http://vocab.getty.edu/aat/300435416', 'http://vocab.getty.edu/aat/300080091'];
const citationUris = ['https://lux.collections.yale.edu/data/concept/ceef9d2e-1a07-4269-827f-8c407e4d4711', 'http://vocab.getty.edu/aat/300311705', 'http://vocab.getty.edu/aat/300026497'];
const dimensionsStatementUris = ['https://lux.collections.yale.edu/data/concept/53922f57-dab5-43c5-a527-fc20a63fe128', 'http://vocab.getty.edu/aat/300435430'];
const accessStatementUris = ['https://lux.collections.yale.edu/data/concept/03f4eb19-0611-4f31-8e09-fc111c52f898', 'http://vocab.getty.edu/aat/300133046'];
const materialsStatementUris = ['https://lux.collections.yale.edu/data/concept/a51a170c-211c-4cc1-bb11-52e24836117f', 'http://vocab.getty.edu/aat/300435429'];
const provenanceUris = ['https://lux.collections.yale.edu/data/concept/dd8b8c75-3f4b-4071-a231-161ae556e572', 'http://vocab.getty.edu/aat/300435438'];

const linkedArtCachePath = './content/_assets/linked-art.json';
const figureCachePath = path.join('./content/_assets/figures.json');
const immutableFieldNames = ['id', 'title', 'figure', 'link', 'thumbnail'];

// Function to validate the object field names specified in config.yaml
function validateObjectFieldNames(config) {
    // Get the keys (field names) from the objectFieldNames property in the config object
    const objectFieldNames = Object.keys(config.objectFieldNames);

    // Find the intersection of objectFieldNames with immutableFieldNames
    const intersection = immutableFieldNames.filter(fieldName => objectFieldNames.includes(fieldName));

    // If there are any common field names between objectFieldNames and immutableFieldNames, throw an error
    if (intersection.length > 0) {
        throw new Error(`Cannot change the following immutable field names in config.yaml: ${immutableFieldNames.join(', ')}`);
    }
}

async function fetchData(uri) {
    try {
        // Fetch Linked Art recording using content negotation to request JSON-LD
        let response = await fetch(uri, {
            headers: {
                'Accept': 'application/ld+json'
            }
        });

        // If JSON-LD is not available (status 406), fall back to regular JSON
        if (response.status === 406) {
            response = await fetch(uri, {
                headers: {
                    'Accept': 'application/json'
                }
            });
        }
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        console.error(`An error occurred while fetching data from ${uri}`);
    }
    return;
}

async function searchClassifiedAs(classified_as, uris) {
    if (Array.isArray(classified_as)) {
        for (const item of classified_as) {
            if (item.id && uris.includes(item.id)) {
                return true;
            }
        }
    }
    return;
}

async function getIds(array) {
    let ids = [];
    if (Array.isArray(array)) {
        for (const item of array) {
            if (item.id) {
                ids.push(item.id);
            }
        }
        return ids;
    }
    return;
}

function formatArray(arr) {
    if (arr.length === 0) {
        return;
    } else if (arr.length === 1) {
        return arr[0];
    } else {
        return arr.join(', ');
    }
}

async function getContent(data, array, primaryNameUris, enUris, contentType, precision) {
    if (!data) {
        console.log('JSON-LD not available.');
        return;
    }
    let primaryAndEn = [];
    let primary = [];
    let other = [];
    try {
        if (Array.isArray(array)) {
            for (const item of array) {
                if (!contentType || item.type === contentType) {
                    let hasPrimaryNameUri = false;
                    let hasEnUri = false;
                    if (Array.isArray(item.classified_as)) {
                        hasPrimaryNameUri = await searchClassifiedAs(item.classified_as, primaryNameUris);
                    }
                    if (Array.isArray(item.language)) {
                        hasEnUri = await searchClassifiedAs(item.language, enUris);
                    }
                    if (precision.includes('primaryAndEn') && hasPrimaryNameUri && hasEnUri) {
                        primaryAndEn.push(item.content);
                    } else if (precision.includes('primary') && hasPrimaryNameUri && !hasEnUri) {
                        primary.push(item.content);
                    } else if (precision.includes('other') && !hasPrimaryNameUri && !hasEnUri){
                        other.push(item.content);
                    }
                }
            }
        }
    } catch (error) {
        console.log('An error occurred while fetching content:', error);
        return;
    }
    return { primaryAndEn, primary, other };
}

async function getObjectData(linkedArtCachePath, uri, options) {
    // Initialize linked-art.json cache
    let cachedData = {};

    // Initialize variables for additional responses
    let objectData;
    try {
        const cacheContent = await fs.promises.readFile(linkedArtCachePath, 'utf-8');
        cachedData = JSON.parse(cacheContent);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            throw error; // Rethrow the error if it is not related to file not found
        }
    }

    // If the provided URI is already in cache, retrieve data from cache
    if (uri in cachedData && !options['force']) {
        objectData = cachedData[uri].objectData;

    // Fetch Linked Art data
    } else {
        objectData = await fetchData(uri);
    }
    return objectData;
}

async function findObjectTitle(data, primaryNameUris, enUris, precision) {
    if (!data) {
        console.log('JSON-LD not available.');
        return;
    }
    try {
        const { primaryAndEn, primary, other } = await getContent(data, data.identified_by, primaryNameUris, enUris, 'Name', precision)
        if (primaryAndEn.length > 0) {
            return formatArray(primaryAndEn);
        } else if (primary.length > 0) {
            return formatArray(primary);
        } else if (other.length > 0) {
            return formatArray(other);
        } else {
            console.log('Object title not found.');
            return;
        }
    } catch (error) {
        console.log('An error occurred while fetching object title:', error);
        return;
    }
}

async function findLinguisticObject(data, linguisticObjectUris) {
    if (!data) {
        console.log('JSON-LD not available.');
        return;
    }
    let result;
    try {
        if (Array.isArray(data.referred_to_by)) {
            for (const item of data.referred_to_by) {
                if (item.type === 'LinguisticObject' && Array.isArray(item.classified_as)) {
                    if (await searchClassifiedAs(item.classified_as, linguisticObjectUris)) {
                        result = item.content;
                        return result;
                    }
                }
            }
        }
    } catch (error) {
        console.log(`An error occurred while fetching LinguisticObject:`, error);
        return;
    }
    return result;
}

async function findAccession(data, accessionUris) {
    if (!data) {
        console.log('JSON-LD not available.');
        return;
    }
    let accession;
    try {
        for (const item of data.identified_by) {
            if (item.type === 'Identifier') {
                if (await searchClassifiedAs(item.classified_as, accessionUris)) {
                    accession = item.content;
                    return accession;
                }
            }
        }
        if (!accession) {
            console.log('Accession number not found.');
        }
    } catch (error) {
        console.log('An error occurred while fetching accession number:', error);
        return
    }
    return accession;
}

async function findCreator(data, uris, enUris, precision) {
    if (!data) {
        console.log('JSON-LD not available.');
        return;
    }
    let creatorIds = [];
    try {
        if (data.produced_by && data.produced_by.part) {
            for (const item of data.produced_by.part) {
                const ids = await getIds(item.carried_out_by);
                if (ids !== undefined && ids.length > 0) {
                    creatorIds.push(ids);
                }
            }
        } else if (data.produced_by && data.produced_by.carried_out_by) {
            const ids = await getIds(data.produced_by.carried_out_by);
            if (ids !== undefined && ids.length > 0) {
                creatorIds.push(ids);
            }
        }
        if (creatorIds.length === 0) {
            console.log('No creator URIs found.');
            return;
        }
        creatorIds = creatorIds.map(id => String(id).startsWith("https://vocab.getty.edu") ? id + ".json" : id);
        for (const id of creatorIds) {
            try {
                const creatorData = await fetchData(id);
                const { primaryAndEn, primary, other } = await getContent(creatorData, creatorData.identified_by, uris, enUris, 'Name', precision);
                if (primaryAndEn.length > 0) {
                    return formatArray(primaryAndEn);
                } else if (primary.length > 0) {
                    return formatArray(primary);
                } else if (other.length > 0) {
                    return formatArray(other);
                }
            } catch (fetchError) {
                continue;
            }
        }
        if (creatorIds.length > 0) {
            console.log('Creator URI found, but name extraction was unsuccessful. Returning URI.')
            return formatArray(creatorIds.map(id => id.toString()));
        } else {
            console.log('Creator not found.');
            return;
        }
    } catch (error) {
        console.log('An error occurred while fetching creator:', error);
        return;
    }
}

async function findYear(data, keyValuePairs) {
    if (!data) {
        console.log('JSON-LD not available.');
        return;
    }
    let year;
    try {
        if (data.produced_by && data.produced_by.timespan && data.produced_by.timespan.identified_by) {
            year = data.produced_by.timespan.identified_by[0].content;
        };
        if (!year) {
            if (!Object.values(keyValuePairs).includes('period')) {
                console.log('Year not found. Try period.');
            } else {
                console.log('Year not found.');
            }
        }
    } catch (error) {
        console.log('An error occurred while fetching year:', error);
    }
    return year;
}

async function findObjectType(data, objectTypeUris, primaryNameUris, enUris, precision) {
    if (!data) {
        console.log('JSON-LD not available.');
        return;
    }
    let objectTypeIds = [];
    let objectType;
    try {
        if (Array.isArray(data.classified_as)) {
            for (const item of data.classified_as) {
                const result = await searchClassifiedAs(item.classified_as, objectTypeUris);
                if (result) {
                    objectTypeIds.push(item.id);
                }
            }
        }
        if (objectTypeIds.length === 0) {
            if (Array.isArray(data.referred_to_by)) {
                const result = await findLinguisticObject(data, objectTypeUris)
                if (result) {
                    objectType = result;
                    return objectType;
                }
            }
        }
        objectTypeIds = objectTypeIds.map(uri => String(uri).startsWith("https://vocab.getty.edu") ? uri + ".json" : uri);
        for (const uri of objectTypeIds) {
            try {
                const objectTypeData = await fetchData(uri);
                const { primaryAndEn, primary, other } = await getContent(objectTypeData, objectTypeData.identified_by, primaryNameUris, enUris, 'Name', precision);
                if (primaryAndEn.length > 0) {
                    return formatArray(primaryAndEn);
                } else if (primary.length > 0) {
                    return formatArray(primary);
                } else if (other.length > 0) {
                    return formatArray(other);
                }
            } catch (fetchError) {
                continue;
            }
        }
        if (objectTypeIds.length > 0) {
            console.log('Object type URI found, but name extraction was unsuccessful. Returning URI.')
            return formatArray(objectTypeIds.map(uri => uri.toString()));
        }
        if (objectTypeIds.length === 0 && !objectType) {
            console.log('Object type not found.')
            return;
        }
    } catch (error) {
        console.log('An error occurred while fetching object type:', error);
        return;
    }
}

async function findWebPage(data, webPageUris) {
    if (!data) {
        console.log('JSON-LD not available.');
        return;
    }
    let webPage;
    try {
        if (Array.isArray(data.subject_of)) {
            for (const subject_of of data.subject_of) {
                if (Array.isArray(subject_of.digitally_carried_by)) {
                    for (const digitally_carried_by of subject_of.digitally_carried_by) {
                        if (await searchClassifiedAs(digitally_carried_by.classified_as, webPageUris)) {
                            webPage = digitally_carried_by.access_point[0].id;
                            return webPage;
                        }
                    }
                }
            }
        }
        if (Array.isArray(data.subject_of)) {
            for (const item of data.subject_of) {
                if (await searchClassifiedAs(item.classified_as, webPageUris)) {
                    webPage = item.id;
                    return webPage;
                }
            }
        }
        if (!webPage) {
            console.log('Web page not found.');
        }
    } catch (error) {
        console.log('An error occurred while fetching web page:', error);
        return;
    }
    return webPage;
}

async function findThumbnailUri(data, thumbnailUris) {
    if (!data) {
        console.log('JSON-LD not available.');
        return;
    }
    let thumbnailUri;
    try {
        if (data.representation && Array.isArray(data.representation)) {
            for (const representation of data.representation) {
                if (representation.digitally_shown_by && Array.isArray(representation.digitally_shown_by)) {
                    for (const digitally_shown_by of representation.digitally_shown_by) {
                        if (await searchClassifiedAs(digitally_shown_by.classified_as, thumbnailUris)) {
                            thumbnailUri = digitally_shown_by.access_point[0].id;
                            return thumbnailUri;
                        }
                    }
                }
                else {
                    if (await searchClassifiedAs(representation.classified_as, thumbnailUris)) {
                        thumbnailUri = representation.id;
                        return thumbnailUri;
                    }
                }
            }
        }
        if (!thumbnailUri) {
            console.log('Thumbnail URI not found.');
        }
    } catch (error) {
        console.log('An error occurred while fetching thumbnail URI:', error);
        return;
    }

    return thumbnailUri;
}

async function findDescription(data, descriptionUris, enUris, precision) {
    if (!data) {
        console.log('JSON-LD not available.');
        return;
    }
    let description;
    try {
        if (Array.isArray(data.referred_to_by)) {
            const { primaryAndEn, primary, other } = await getContent(data, data.referred_to_by, descriptionUris, enUris, 'LinguisticObject', precision)
            if (primaryAndEn.length > 0) {
                return formatArray(primaryAndEn);
            } else if (primary.length > 0) {
                return formatArray(primary);
            } else if (other.length > 0) {
                return formatArray(other);
            }
        }
        if (!description) {
            console.log('Description not found.');
        }
    } catch (error) {
        console.log('An error occurred while fetching description:', error);
        return;
    }
    return description;
}

async function findCitations(data, citationUris) {
    if (!data) {
        console.log('JSON-LD not available.');
        return;
    }
    let citations = [];
    try {
        if (Array.isArray(data.referred_to_by)) {
            for (const item of data.referred_to_by) {
                if (await searchClassifiedAs(item.classified_as, citationUris)) {
                    citations.push(item.content || item.id);
                }
            }
        }
        if (citations.length === 0) {
            console.log('No citations found.');
            return;
        } else {
            return citations;
        }
    } catch (error) {
        console.log('An error occurred while fetching citations:', error);
        return;
    }
}

async function findFindSpot(data, primaryNameUris) {
    if (!data) {
        console.log('JSON-LD not available.');
        return;
    }
    let findSpotId;
    let findSpot;
    try {
        if (data.encountered_by && data.encountered_by[0].took_place_at) {
            findSpotId = data.encountered_by[0].took_place_at[0].id;
            const findSpotData = await fetchData(findSpotId);
            if (findSpotData) {
                findSpot = await findPrimaryName(findSpotData, primaryNameUris);
                return findSpot;
            }
        };
        if (!findSpot) {
            findSpot = findLinguisticObject(data, 'https://data.getty.edu/museum/ontology/linked-data/tms/object/place/found')
            if (findSpot) {
                return findSpot;
            }
        }
        if (!findSpot) {
            console.log('Find spot not found.');
        }
    } catch (error) {
        console.log('An error occurred while fetching find spot:', error);
    }
    return findSpot;
}

async function findSet(data, primaryNameUris) {
    if (!data) {
        console.log('JSON-LD not available.');
        return;
    }
    let setId;
    let set;
    try {
        if (data.member_of) {
            setId = data.member_of[0].id;
            const setData = await fetchData(setId);
            if (setData) {
                set = await findPrimaryName(setData, primaryNameUris);
                return set;
            }
        };
        if (!set) {
            console.log('Set not found.');
        }
    } catch (error) {
        console.log('An error occurred while fetching set:', error);
    }
    return set;
}

async function findOwner(data, primaryNameUris) {
    if (!data) {
        console.log('JSON-LD not available.');
        return;
    }
    let ownerId;
    let owner;
    try {
        if (data.current_owner) {
            ownerId = data.current_owner[0].id;
            const ownerData = await fetchData(ownerId);
            if (ownerData) {
                owner = await findPrimaryName(ownerData, primaryNameUris);
                return owner;
            }
        };
        if (!owner) {
            console.log('Owner not found.');
        }
    } catch (error) {
        console.log('An error occurred while fetching owner:', error);
    }
    return owner;
}

async function findLocation(data, primaryNameUris) {
    if (!data) {
        console.log('JSON-LD not available.');
        return;
    }
    let locationId;
    let location;
    try {
        if (data.current_location) {
            locationId = data.current_location.id;
            const locationData = await fetchData(locationId);
            if (locationData) {
                location = await findPrimaryName(locationData, primaryNameUris);
                return location;
            }
        };
        if (!location) {
            console.log('Location not found.');
        }
    } catch (error) {
        console.log('An error occurred while fetching location:', error);
    }
    return location;
}

async function findTookPlaceAt(data, primaryNameUris) {
    if (!data) {
        console.log('JSON-LD not available.');
        return;
    }
    let tookPlaceAtId;
    let tookPlaceAt;
    try {
        if (data.produced_by && data.produced_by.took_place_at) {
            tookPlaceAtId = data.produced_by.took_place_at[0].id;
            const tookPlaceAtData = await fetchData(tookPlaceAtId);
            if (tookPlaceAtData) {
                tookPlaceAt = await findPrimaryName(tookPlaceAtData, primaryNameUris);
                return tookPlaceAt;
            }
        }
        if (data.encountered_by && data.encountered_by[0].took_place_at) {
            tookPlaceAtId = data.encountered_by[0].took_place_at[0].id;
            const tookPlaceAtData = await fetchData(tookPlaceAtId);
            if (tookPlaceAtData) {
                tookPlaceAt = await findPrimaryName(tookPlaceAtData, primaryNameUris);
                return tookPlaceAt;
            }
        }
        if (!tookPlaceAt) {
            console.log('Took place at not found.');
        }
    } catch (error) {
        console.log('An error occurred while fetching took place at:', error);
    }
    return tookPlaceAt;
}

async function findEncounteredBy(data, uris, enUris, precision) {
    if (!data) {
        console.log('JSON-LD not available.');
        return;
    }
    let encounteredByIds = [];
    try {
        if (data.encountered_by) {
            for (const item of data.encountered_by) {
                const ids = await getIds(item.carried_out_by);
                encounteredByIds.push(ids);
            }
        }
        if (encounteredByIds.length === 0) {
            console.log('No encountered by URIs found.');
            return;
        }
        encounteredByIds = encounteredByIds.map(id => String(id).startsWith("https://vocab.getty.edu") ? id + ".json" : id);
        for (const id of encounteredByIds) {
            try {
                const encounteredByData = await fetchData(id);
                const { primaryAndEn, primary, other } = await getContent(encounteredByData, encounteredByData.identified_by, uris, enUris, 'Name', precision);
                if (primaryAndEn.length > 0) {
                    return formatArray(primaryAndEn);
                } else if (primary.length > 0) {
                    return formatArray(primary);
                } else if (other.length > 0) {
                    return formatArray(other);
                }
            } catch (fetchError) {
                continue;
            }
        }
        if (encounteredByIds.length > 0) {
            console.log('Encountered by URI found, but name extraction was unsuccessful. Returning URI.')
            return formatArray(encounteredByIds.map(id => id.toString()));
        } else {
            console.log('Encountered by not found.');
            return;
        }
    } catch (error) {
        console.log('An error occurred while fetching encountered by:', error);
        return;
    }
}

// Helper function used within the dimensions pattern
// Currently this excludes only the "positional attributes" AAT, used in Getty data to enumerate data values but not a physical dimension as such
// The function could be expanded if other such entries need to be excluded elsewhere however
function excludeEntry(entry) {
    return entry.classified_as?.some(classification => findGettyUri(classification) === "http://vocab.getty.edu/aat/300010269");
}

// Helper function to retrieve dimension and unit labels from structured data
async function getDimensionAndUnitLabels(dimension) {
    const dimensionUri = findGettyUri(dimension.classified_as);
    const unitUri = dimension.unit ? findGettyUri(dimension.unit) : null;

    const [dimensionLabel, unitLabel] = await Promise.all([
        dimensionUri ? getTerm(dimensionUri, "Dimension") : null,
        unitUri ? getTerm(unitUri, "Unit") : null
    ]);

    if (!dimensionLabel) {
        logMessages.add(`Unable to retrieve dimension type from ${dimensionUri || dimension.classified_as.map(item => item.id).join(', ')}`);
    }

    if (!unitLabel) {
        logMessages.add(`Unable to retrieve dimension unit from ${unitUri || (dimension.unit ? dimension.unit.id : 'unknown unit')}`);
    }

    return { dimensionLabel, unitLabel };
}    

// Pattern One handles dimensions data in which dimension set information (e.g. "frame", "unframed") is provided using the "member_of" property
// This is how Getty currently structures their dimensions data
async function processPatternOne(dimension) {
    const { dimensionLabel, unitLabel } = await getDimensionAndUnitLabels(dimension);
    return dimension.value && dimensionLabel && unitLabel ? `${dimensionLabel}: ${dimension.value} ${unitLabel}` : null;
}

// Pattern Two handles dimensions data in which the analogous information is instead provided either as an additional classification label...
// ...referring to a dimension's "assigned_by" property (e.g. https://lux.collections.yale.edu/data/object/d92110b4-3f23-4bd0-b556-0a1659787a2d)...
// ...or when it is directly associated with the dimension (e.g. https://lux.collections.yale.edu/data/object/4659e968-f94c-4f18-bec7-18de459bd912)
async function processPatternTwo(dimension) {
    const { dimensionLabel, unitLabel } = await getDimensionAndUnitLabels(dimension);
    let additionalClassLabel = null;

    if (dimension.assigned_by && Array.isArray(dimension.assigned_by)) {
        for (const assignment of dimension.assigned_by) {
            if (assignment.classified_as && assignment.classified_as.length > 0) {
                const additionalUri = assignment.classified_as[0]?.id;
                additionalClassLabel = additionalUri ? await getTerm(additionalUri, "Additional Classification") : null;

                if (!additionalClassLabel) {
                    logMessages.add(`Unable to retrieve additional classification label from ${additionalUri}`);
                }
                break;
            }
        }
    } else if (dimension.classified_as && dimension.classified_as.length > 1) {
        const additionalUri = dimension.classified_as[1]?.id;
        additionalClassLabel = additionalUri ? await getTerm(additionalUri, "Additional Classification") : null;

        if (!additionalClassLabel) {
            logMessages.add(`Unable to retrieve additional classification label from ${additionalUri}`);
        }
    }

    return dimension.value && dimensionLabel && unitLabel ? { statement: `${dimensionLabel}: ${dimension.value} ${unitLabel}`, additionalClassLabel: additionalClassLabel || '' } : null;
}

// further helper functions used within the dimensions pattern
async function processDimension(dimension) {
    if (excludeEntry(dimension)) return null;

    if (dimension.member_of && Array.isArray(dimension.member_of)) {
        return await processPatternOne(dimension);
    } else {
        return await processPatternTwo(dimension);
    }
}

async function findDimensions(data) {
    const dimensionsBySet = {};
    
    if (data.dimension && Array.isArray(data.dimension)) {
        for (const dim of data.dimension) {
            const dimensionsData = await processDimension(dim);
            
            if (dimensionsData) {
                let setLabel = '';
                
                if (typeof dimensionsData === 'string') {
                    for (const member of dim.member_of) {
                        const label = await getTerm(member.id, "Set Label");
                        if (label) {
                            setLabel = label;
                            break;
                        }
                    }
                    if (!dimensionsBySet[setLabel]) dimensionsBySet[setLabel] = [];
                    dimensionsBySet[setLabel].push(dimensionsData);
                } else {
                    const { statement, additionalClassLabel } = dimensionsData;
                    if (!dimensionsBySet[additionalClassLabel]) dimensionsBySet[additionalClassLabel] = [];
                    dimensionsBySet[additionalClassLabel].push(statement);
                }
            }
        }
    }
    
    return Object.entries(dimensionsBySet)
        .map(([set, dims]) => `${set ? `${set}: ` : ''}${dims.join('; ')}`)
        .join('\n') || null;
}

    // Function to find Getty vocabulary URIs within an object, which are generally preferred for retrieving term information in the script
    function findGettyUri(obj) {
        if (obj && typeof obj === 'object') {
            if (Array.isArray(obj)) {
                for (const item of obj) {
                    const foundUri = findGettyUri(item);
                    if (foundUri) return foundUri;
                }
            } else {
                for (const value of Object.values(obj)) {
                    if (typeof value === 'string' && value.includes('vocab.getty.edu')) return value;
                    const foundUri = findGettyUri(value);
                    if (foundUri) return foundUri;
                }
            }
        }
        return null;
    }

// Function to retrieve terms from URIs
// Retrieves the preferred term by default but can also retrieve alternative terms
// Alternative terms often provide useful context in brackets, e.g. "description (activity)" vs. "description" for https://vocab.getty.edu/aat/300080091
async function getTerm(uri, dataField, termType = 'preferred') {
    try {
        const data = await fetchData(uri);
        const identifiedBy = data?.identified_by;
        if (Array.isArray(identifiedBy)) {
            for (const item of identifiedBy) {
                const classifiedAs = item?.classified_as || [];
                if (termType === 'preferred') {
                    if (classifiedAs.some(ca => ca.id === "http://vocab.getty.edu/aat/300404670")) return item.content;
                    if (classifiedAs.some(ca => ca.equivalent?.some(eq => eq.id === "http://vocab.getty.edu/aat/300404670"))) return item.content;
                } else {
                    if (classifiedAs.some(ca => ca.id === "http://vocab.getty.edu/aat/300404670")) {
                        const alternativeContent = item?.alternative?.[0]?.content;
                        if (alternativeContent) return alternativeContent;
                    }
                }
            }
        }
        // When no preferred term is present, returns label content instead, logging this as an issue
        // While this is certainly not ideal practice, this is often the only identifiable approximant to term information in a significant number of records
        // e.g. sets used to associate structured dimensions data in Getty records are formatted as such: https://data.getty.edu/museum/collection/object/0a0fdd7a-8859-4cae-8a5e-8f16ef25a8f6/dimensions/b424c1b2-65e7-552a-90f8-27ad6bbf8cb3/set
        if (termType === 'preferred') {
            const label = data?.label || data?._label;
            if (label) {
                logMessages.add(`No preferred term found for ${uri}. "${label === data?.label ? 'label' : '_label'}" retrieved instead.`);
                return label;
            }
        }
        throw new Error(`No ${termType} term found for ${uri}`);
    } catch (error) {
        logMessages.add(`Error retrieving ${dataField} data: ${error.message}`);
        return null;
    }
}

// Function to find image URI in IIIF manifest
async function findImageUri(iiifManifestData) {
    // Check if iiifManifestData exists
    if (iiifManifestData) {
        // Find out which IIIF presentation API the manifest conforms to
        const context = iiifManifestData['@context'];
        // Declare imageUri variable outside the conditional block
        let imageUri;

        // Check if context is an array or a single context
        if (Array.isArray(context)) {
            // Check if the context array includes the IIIF Presentation 3 context
            if (context.includes('http://iiif.io/api/presentation/3/context.json')) {
                imageUri = iiifManifestData.items?.[0]?.items?.[0]?.items?.[0]?.body?.id;
            } 
            // Check if the context array includes the IIIF Presentation 2 context
            else if (context.includes('http://iiif.io/api/presentation/2/context.json')) {
                imageUri = iiifManifestData.sequences?.[0]?.canvases?.[0]?.images?.[0]?.resource["@id"];
            }
        } else {
            // If context is a single string, check if it matches IIIF Presentation 3 or 2
            if (context === 'http://iiif.io/api/presentation/3/context.json') {
                imageUri = iiifManifestData.items?.[0]?.items?.[0]?.items?.[0]?.body?.id;
            } else if (context === 'http://iiif.io/api/presentation/2/context.json') {
                imageUri = iiifManifestData.sequences?.[0]?.canvases?.[0]?.images?.[0]?.resource["@id"];
            }
        }

        // If an image file is found, return its URI
        if (imageUri) {
            return imageUri;
        }
    }
    // If no image URI is found or iiifManifestData is falsy, return undefined
    return;
}

async function resizeImage(iiifManifestData, options, imageUri) {
    if (options.resize) {
        // Start interactive prompt for resizing
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        // Determine the largest dimension of the image (width or height)
        const defaultWidth = iiifManifestData.items?.[0]?.items?.[0]?.items?.[0]?.body?.width;
        const defaultHeight = iiifManifestData.items?.[0]?.items?.[0]?.items?.[0]?.body?.height;
        const largestDimensionName = defaultWidth >= defaultHeight ? 'width' : 'height';

        // Request resize option
        console.log('Enter the number or percentage of pixels for resizing (e.g., 800 for pixels, or 50% for percentage). This will be applied to the largest dimension (width or height), and the other dimension will be scaled proportionally.');

        // Log the largest dimension
        if (largestDimensionName === 'width') {
            console.log('The largest dimension is', largestDimensionName, 'at', defaultWidth, 'pixels.');
        } else if (largestDimensionName === 'height') {
            console.log('The largest dimension is', largestDimensionName, 'at', defaultHeight, 'pixels.');
        }


        const resizeOption = await new Promise((resolve) => {
            rl.question('', (answer) => {
                rl.close();
                resolve(answer);
            });
        });

        // Check if the input is valid
        if (!isNaN(resizeOption) || (typeof resizeOption === 'string' && resizeOption.endsWith('%'))) {
            // Check if the resize option exceeds the largest dimension
            const largestDimensionSize = largestDimensionName === 'width' ? defaultWidth : defaultHeight;
            if (!isNaN(resizeOption) && !(typeof resizeOption === 'string' && resizeOption.endsWith('%'))) {
                if (parseInt(resizeOption) > largestDimensionSize) {
                    console.error('The resize option cannot exceed the largest dimension of the full-size image.');
                    return;
                }
            } else if (typeof resizeOption === 'string' && resizeOption.endsWith('%')) {
                const percentage = parseFloat(resizeOption.slice(0, -1));
                if (percentage > 100) {
                    console.error('The resize option cannot exceed 100%.');
                    return;
                }
            }

            // Calculate resized dimensions
            let resizedUri;

            if (typeof resizeOption === 'string' && resizeOption.endsWith('%')) {
                // Resize by percentage
                const proportion = parseFloat(resizeOption.slice(0, -1)) / 100;
                const newWidth = largestDimensionName === 'width' ? Math.round(defaultWidth * proportion) : '';
                const newHeight = largestDimensionName === 'height' ? Math.round(defaultHeight * proportion) : '';
                resizedUri = imageUri.replace('/full/full/0/default.jpg', `/full/${newWidth},${newHeight}/0/default.jpg`);
            } else {
                // Resize by pixel count
                const newWidth = largestDimensionName === 'width' ? parseInt(resizeOption) : '';
                const newHeight = largestDimensionName === 'height' ? parseInt(resizeOption) : '';
                resizedUri = imageUri.replace('/full/full/0/default.jpg', `/full/${newWidth},${newHeight}/0/default.jpg`);
            }

            console.log(`Image resized successfully to ${resizeOption}.`);
            return resizedUri
        } else {
            console.error('Invalid resize option. Please provide either a number of pixels or a percentage.');
            return;
        }
    }
}

// Function to generate a hash for a buffer
function hashBuffer(buffer) {
    return crypto.createHash('md5').update(buffer).digest('hex');
}

async function startEntryBuildingInteraction() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    try {
        // Prompt the user
        console.log("Interactive Linked Art entry building has been initialized.");

        // Load config.yaml to get object field names
        const config = yaml.load(fs.readFileSync('./content/_data/config.yaml', 'utf8'));
        const objectFieldNames = Object.values(config.objectFieldNames).filter(fieldName => fieldName !== config.objectFieldNames.uri);

        // Prompt user to choose fields
        console.log("Choose the Linked Art data fields you would like to retrieve by entering a comma-separated list.");
        console.log("Note: object title and Linked Art URI are always included in the entries and therefore are not present in the list of options.");
        console.log(objectFieldNames.join(', '));

        // Handle user input for field selection
        const chosenFields = await new Promise((resolve, reject) => {
            rl.question('', (chosenFields) => {
                resolve(chosenFields);
            });
        });

        // Close the readline interface
        rl.close();

        // Convert the chosen fields to an array
        let fieldsList = chosenFields.split(',').map(field => field.trim().toLowerCase());

        // Validate each field in the fieldsList
        for (const field of fieldsList) {
            if (!objectFieldNames.includes(field)) {
                throw new Error(`Invalid field '${field}' provided.`);
            }
        }

        // Add the 'uri' field from config
        fieldsList.push(config.objectFieldNames.uri);
        
        return fieldsList;

    } catch (error) {
        rl.close();
        return Promise.reject(error);
    }
}

// Function to start interaction if data type is 'Set'
function startActivityInteraction() {
    return new Promise((resolve, reject) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        // Prompt the user
        console.log("The provided URI is of type 'Activity' and may be used to access a set of object URIs.");
        console.log("Enter 'p' to process all the objects in the set.");
        console.log("Enter 's' to generate a spreadsheet of information about the objects.");
        console.log("Enter 'b' to do both.");

        // Handle user input
        rl.question('', (answer) => {
            // Close the readline interface
            rl.close();

            // Resolve with the user's response
            resolve(answer.toLowerCase());
        });
    });
}

// Function to collect a set of object URIs using activity URI
async function collectSetUris(data, uri) {
    // Check if the link for the set of items exists
    const eventIncludedItemsLink = data?._links["lux:eventIncludedItems"]?.href;
    if (!eventIncludedItemsLink) {
        throw new Error('Link for the set of items was not found.');
    }
    let allObjectURIs = [];
    let page = 1;
    let nextPageLink = `${eventIncludedItemsLink}&page=${page}`;

    // Iterate through all available pages of the set
    while (nextPageLink) {
        // Get the page's data
        const nextPageLink = `${eventIncludedItemsLink}&page=${page}`;
        console.log(`Fetching page ${page} of the set...`);
        const setData = await fetchData(nextPageLink);

        // Collect URIs for the objects in the set from the current page
        const orderedItems = setData?.orderedItems || [];
        
        // Check if the page is empty
        if (orderedItems.length === 0) {
            break;
        }
        const objectURIs = orderedItems.map(item => item.id).filter(Boolean);
        allObjectURIs = allObjectURIs.concat(objectURIs);

        // Get the link for the next page, if available
        // Linked Art devs working on nextPageLink
        //nextPageLink = setData?._links?.next?.href;
        page++;
    }
    console.log('Number of object URIs collected:', allObjectURIs.length);
    uri = allObjectURIs.join(' '); // Join the array into a space-separated string
    return uri
}

// Find content corresponding to primaryNameUris
function findPrimaryName(data, primaryNameUris) {
    if (!data) {
        console.log('JSON-LD not available.');
        return;
    }
    let primaryName;
    try {
        if (Array.isArray(data.identified_by)) {
            for (const item of data.identified_by) {
                const result = searchClassifiedAs(item.classified_as, primaryNameUris);
                if (result) {
                    primaryName = item.content;
                    return primaryName;
                }
            }
        }
    } catch (error) {
        console.log('An error occurred while fetching preferred name:', error);
    }
    return primaryName;
}

async function findIIIFManifest(data) {
    if (!data) {
        console.log('JSON-LD not available.');
        return;
    }
    let iiifManifestData;
    let iiifFound = false;
    try {
        if (data.subject_of && Array.isArray(data.subject_of)) {
            for (const subject_of of data.subject_of) {
                if (subject_of.digitally_carried_by && Array.isArray(subject_of.digitally_carried_by)) {
                    for (const item of subject_of.digitally_carried_by) {
                        if (item.conforms_to && item.conforms_to[0].id && item.conforms_to[0].id.startsWith('http://iiif.io/api/presentation')) {
                            try {
                                iiifManifestData = await fetchData(item.access_point[0].id);
                                return iiifManifestData;
                            } catch (error){
                                console.error(`Failed to fetch IIIF manifests: ${error}`);
                            }
                        }
                    }
                }
            }
        }
        if (iiifFound === false && data.subject_of) {
            for (const item of data.subject_of) {
                if (item.conforms_to && item.conforms_to[0].id && item.conforms_to[0].id.startsWith('http://iiif.io/api/presentation')) {
                    try {
                        iiifManifestData = await fetchData(item.id);
                        return iiifManifestData;
                    } catch (error){
                        console.error(`Failed to fetch IIIF manifests: ${error}`);
                    }
                }
            }
        }
    } catch (error) {
        console.log(`An error occurred while fetching iiifManifestData:, ${error}`);
    }
    return iiifManifestData;
}

async function createSpreadsheet(uri, data, options) {
    let activityTitle = findPrimaryName(data, primaryNameUris);
    let uriList;
    uriList = uri.split(' ');
    const totalObjects = uriList.length;
    let csvContent = 'Linked Art URI,Object Title,Creator,Object Type,Image URI\n'; // CSV header
    let processedObjects = 0; // Counter for processed objects
    for (const uri of uriList) {
        processedObjects++;
        let cachedData = {};
        try {
            const cacheContent = await fs.promises.readFile(linkedArtCachePath, 'utf-8');
            cachedData = JSON.parse(cacheContent);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error; // Rethrow the error if it is not related to file not found
            }
        }
        
        let objectData;
        if (uri in cachedData) {
            console.log(`Retrieving Linked Art from cache... ${processedObjects}/${totalObjects}`);
            objectData = cachedData[uri].objectData;
        } else {
            objectData = await getObjectData(linkedArtCachePath, uri, options);
        }

        // Find objectTitle in objectData
        let objectTitle;
        objectTitle = await findObjectTitle(objectData, primaryNameUris, enUris, ['primaryAndEn', 'primary', 'other']);
        
        // Find creator in the objectData
        let creator;
        creator = await findCreator(objectData, primaryNameUris, enUris, ['primaryAndEn', 'primary', 'other']);

        // Find objectTypeData in the objectData
        let type;
        type = await findObjectType(objectData, objectTypeUris, primaryNameUris, enUris, ['primaryAndEn', 'primary']);

        // Find iiifManifestData in objectData
        const iiifManifestData = await findIIIFManifest(objectData);

        // Extract image URI
        let imageUri;
        try {
            imageUri = await findImageUri(iiifManifestData);
        } catch (error) {
            console.error(`Image URI not found in IIIF manifest.`);
        }

        // Ensure imageUri is defined before proceeding
        if (imageUri && options.resize) {
            try {
                imageUri = await resizeImage(iiifManifestData, options, imageUri);
            } catch (error) {
                console.error(`Error occurred while resizing image.`);
            }
        }

        // Append data to the CSV content
        csvContent += `"${uri}","${objectTitle || 'Unknown Title'}","${creator || 'Unknown Creator'}","${type || 'Unknown Type'}","${imageUri || 'Image URI not found'}"\n`;
    }

    // Write the CSV content to a file
    activityTitle = activityTitle.replace(/[^\w\s\-]/g, '_');
    await fs.promises.writeFile(`./${activityTitle}.csv`, csvContent);
    console.log('Spreadsheet was created successfully and exported to current directory.')

    if (options['select']) {
        const readline = createInterface({
            input: process.stdin,
            output: process.stdout
        });
    
        // Parse CSV content to extract unique creators and object types
        const creatorSet = new Set();
        const typeSet = new Set();
    
        // Split CSV content into lines
        const lines = csvContent.split('\n');
    
        // Extract headers to get column indices
        const headers = lines[0].split(',');
        const creatorIndex = headers.findIndex(header => header.trim() === 'Creator');
        const typeIndex = headers.findIndex(header => header.trim() === 'Object Type');
    
        // Process each line of the CSV content to extract unique creators and object types
        for (let i = 1; i < lines.length; i++) {
            const columns = [];
            let column = '';
            let withinQuotes = false;
    
            for (const char of lines[i]) {
                if (char === '"') {
                    withinQuotes = !withinQuotes;
                } else if (char === ',' && !withinQuotes) {
                    columns.push(column.trim());
                    column = '';
                } else {
                    column += char;
                }
            }
    
            columns.push(column.trim());
    
            const creator = columns[creatorIndex];
            const type = columns[typeIndex];
    
            if (creator && creator !== 'Unknown Creator') {
                creatorSet.add(creator);
            }
            if (type && type !== 'Unknown Type') {
                typeSet.add(type);
            }
        }
    
        const uniqueCreators = [...creatorSet];
        const uniqueTypes = [...typeSet];
    
        console.log('Unique Creator Names:', uniqueCreators);
        console.log('Unique Object Types:', uniqueTypes);
    
        await new Promise((resolve) => {
            readline.question('Please select the URIs you would like to process based on creators and object types (e.g., "creators: raphael, vincent van gogh AND/OR types: drawing, painting"): ', async (input) => {
                let selectedCreators;
                let selectedTypes;
                const selections = input.split(/(?:\s+AND\s+|\s+OR\s+)/);
                selectedCreators = selections.find(sel => sel.startsWith('creators:'))?.split(':')[1]?.trim()?.split(',');
                selectedTypes = selections.find(sel => sel.startsWith('types:'))?.split(':')[1]?.trim()?.split(',');
                selectedCreators = await formatArray(selectedCreators);
                selectedTypes = await formatArray(selectedTypes);
                console.log('selected creators:', selectedCreators);
                console.log('selected types:', selectedTypes);
        
                const newUriList = [];
        
                let cachedData = {};
                let objectData;
                try {
                    const cacheContent = await fs.promises.readFile(linkedArtCachePath, 'utf-8');
                    cachedData = JSON.parse(cacheContent);
                } catch (error) {
                    if (error.code !== 'ENOENT') {
                        throw error; // Rethrow the error if it is not related to file not found
                    }
                }
                for (const uri of uriList) {
                    if (uri in cachedData) {
                        console.log(`Retrieving Linked Art from cache... ${processedObjects}/${totalObjects}`);
                        objectData = cachedData[uri].objectData;
                    } else {
                        objectData = await getObjectData(linkedArtCachePath, uri, options);
                    }

                    // Find creator in the objectData
                    let creator;
                    creator = await findCreator(objectData, primaryNameUris, enUris, ['primaryAndEn', 'primary', 'other']);

                    // Find objectTypeData in the objectData
                    let type;
                    type = await findObjectType(objectData, objectTypeUris, primaryNameUris, enUris, ['primaryAndEn', 'primary']);
        
                    if (
                        (selectedCreators.includes(creator)) &&
                        (selectedTypes.includes(type))
                    ) {
                        newUriList.push(uri);
                    }
                }
        
                readline.close();
                uri = newUriList; // Redefine uriList with newUriList for further processing
                resolve(uri); // Resolve the promise with uriList
            });
        });
        return uri;       
    }     
}

export default class yogLinkedArtCommand extends Command {
    static definition = {
        name: 'add',
        description: 'Fetch Linked Art',
        summary: 'fetch Linked Art',
        version: '',
        args: [
            ['<thing>', 'scaffold a new entry in the Quire data files: object, object.figure, figure, or spreadsheet'],
            ['<uri>', 'uri of the linked art object'],
            ['[id1]', 'quire entry id optional for object and figure but required for object.figure'],
            ['[id2]', 'optional quire entry id for object.figure']
        ],
        options: [
            [ '-d', '--dry-run', 'scaffold think without writing data to files' ],
            [ '-f', '--force', 'fetch or refetch data and ignore caches' ],
            [ '-i', '--interactive', 'build your linked art entry with an interactive prompt'],
            [ '-r', '--resize', 'resize the image retrieved'],
            [ '-s', '--select', 'select uris to process from activity spreadsheet'],
        ],
    };

    constructor() {
        super(yogLinkedArtCommand.definition);
    }

    async action(thing, uri, id1, id2, options) {
        try{
            // Load config.yaml and objects.yaml
            const config = yaml.load(fs.readFileSync('./content/_data/config.yaml', 'utf8'));
            let objectsYaml = yaml.load(fs.readFileSync('./content/_data/objects.yaml', 'utf8'));

            // Handle empty objects.yaml, empty object_display_order or object_list, and misplaced hyphens or empty strings in object_display_order or object_list
            // Check if object_display_order seciton in objects.yaml exists, if not, create it with some initial fields and write back objects.yaml
            // If object_display_order exists, but not object_list, object_list is created later just before metadata is pushed to the list
            if (!objectsYaml || 
                !objectsYaml.object_display_order || 
                objectsYaml.object_display_order.length === 0 || 
                objectsYaml === null || 
                (objectsYaml.object_display_order.length === 1 && 
                 objectsYaml.object_display_order[0] === null)
            ) {
                // Preserve existing object_list if it exists and has entries
                let existingObjectList = [];
                if (objectsYaml && objectsYaml.object_list && objectsYaml.object_list.length > 0) {
                    existingObjectList = objectsYaml.object_list;
                }
                objectsYaml = {};
                const initialFields = [
                    config.objectFieldNames.creator,
                    config.objectFieldNames.year,
                    config.objectFieldNames.accession,
                    config.objectFieldNames.uri
                ];
                objectsYaml.object_display_order = [];
                initialFields.forEach(field => {
                    objectsYaml.object_display_order.push(field);
                });
                // Restore existing object_list if it exists and has entries
                if (existingObjectList.length > 0) {
                    objectsYaml.object_list = existingObjectList;
                }
                try {
                    fs.writeFileSync('./content/_data/objects.yaml', yaml.dump(objectsYaml), 'utf8');
                } catch (e) {
                    console.error('Failed to write objects.yaml:', e);
                }
                console.log('There were no fields in object_display_order of objects.yaml. It has been updated with an initial list of fields, including creator, year, accession, and linked art uri. This list can be modified at any time to include any of the following options which are found in the objectFieldList of config.yaml:');
                for (const [key, value] of Object.entries(config.objectFieldNames)) {
                    console.log(value);
                }
                return;
            }

            if (options['interactive']) {
                if (thing !== 'object') {
                    console.error('Interactive entry building only available for object entries.');
                    return;
                }
            
                try {
                    const fieldsList = await startEntryBuildingInteraction();
                    // Clear the existing order
                    objectsYaml.object_display_order = [];
                    // Push each field separately
                    fieldsList.forEach(field => {
                        objectsYaml.object_display_order.push(field);
                    });
                    // Write the updated YAML content back to the file
                    fs.writeFileSync('./content/_data/objects.yaml', yaml.dump(objectsYaml), 'utf8');
                } catch (error) {
                    console.error("An error occurred during object entry building:", error.message);
                    process.exitCode = 1;
                    return;
                }
            }

            objectsYaml = yaml.load(fs.readFileSync('./content/_data/objects.yaml', 'utf8'));

            // Read the existing figures.yaml file
            let figuresYaml = yaml.load(fs.readFileSync('./content/_data/figures.yaml', 'utf8'));

            // Determine which fields will be retrieved and in what order
            const keyValuePairs = {};
            if (objectsYaml.object_display_order.length > 0 && config.objectFieldNames) {
                for (const item of objectsYaml.object_display_order) {
                for (const [key, value] of Object.entries(config.objectFieldNames)) {
                    if (item === value) {
                    keyValuePairs[item] = key;
                    }
                }
                }
            }

            // Check if user has provided multiple URIs
            let uriList;
            uriList = uri.split(' ');
            for (uri of uriList) {
                // Fetch Linked Art recording using content negotation to request JSON-LD
                const data = await fetchData(uri);
                const dataType = data['type']

                // Check if the retrieved record has the required data types
                if (!['HumanMadeObject', 'DigitalObject', 'Activity'].includes(dataType)) {
                    throw new Error(`Failed to process Linked Art. The retrieved record does not have one of the required types (HumanMadeObject, DigitalObject, or Activity).`);
                }

                // Start interaction if data type is 'Activity'
                if (dataType === 'Activity') {
                    const activityAnswer = await startActivityInteraction();
                    switch (activityAnswer) {
                        case 'p':
                            console.log('Processing all objects in the set...');
                            uri = await collectSetUris(data, uri);
                            break;
                        case 's':
                            console.log('Generating spreadsheet of information about the objects...');
                            uri = await collectSetUris(data, uri);
                            await createSpreadsheet(uri, data, options)
                            return;
                        case 'b':
                            console.log('Processing all objects in the set and generating spreadsheet...');
                            uri = await collectSetUris(data, uri);
                            if (options['select']) {
                                uri = await createSpreadsheet(uri, data, options)
                                break;
                            } else if (!options['select']) {
                                createSpreadsheet(uri, data, options)
                                break;
                            }
                        default:
                            throw new Error('Invalid choice. Please enter "p", "s", or "b".');
                    }
                }

                // Split the URI string by space and check if there are multiple URIs
                if (typeof uri === 'string' && uri.split(' ').length > 1) {
                    uriList = uri.split(' ');
                } else if (Array.isArray(uri) && uri.length > 1) {
                    // If the input is an array with multiple elements, assume it contains individual URIs
                    uriList = uri;
                } else {
                    // If the input is neither a string with multiple URIs nor an array with multiple elements, 
                    // consider it as a single URI
                    uriList = [uri];
                }
                for (uri of uriList) {
                    if (options['force']) {
                        console.log('Ignoring cache. If Linked Art for the URI already exists in cache, it will be overwritten.')
                    }

                    if (thing === 'object') {
                        // Validate the object field names
                        validateObjectFieldNames(config);

                        // Fetch the objectId field name from config.yaml
                        const linkedArtUriFieldName = config.objectFieldNames.uri;

                        // Check if the linked art URI already exists in the specified field
                        if (objectsYaml.object_list && objectsYaml.object_list.some(obj => obj[linkedArtUriFieldName] === uri)) {
                            console.log(`The Linked Art URI ${uri} already exists in the objects.yaml file.`);
                            break;
                        }
                        
                        // Initialize figureId
                        let figureId;

                        // Initialize linked-art.json cache
                        let cachedData = {};

                        // Initialize variables for additional responses
                        let objectData, iiifManifestData;

                        try {
                            const cacheContent = await fs.promises.readFile(linkedArtCachePath, 'utf-8');
                            cachedData = JSON.parse(cacheContent);
                        } catch (error) {
                            if (error.code !== 'ENOENT') {
                                throw error; // Rethrow the error if it is not related to file not found
                            }
                        }

                        // If the provided URI is already in cache, retrieve data from cache
                        if (uri in cachedData && !options['force']) {
                            console.log('Retrieving Linked Art from cache...');
                            objectData = cachedData[uri].objectData;
                            iiifManifestData = cachedData[uri].iiifManifestData;
                        }
                    
                        // Get objectData
                        if (!objectData) {
                            objectData = await getObjectData(linkedArtCachePath, uri, options);
                        }                                              
                    
                        iiifManifestData = await findIIIFManifest(objectData);

                        // Store fetched data in the cache file
                        cachedData[uri] = { objectData, iiifManifestData };
                        await fs.promises.writeFile(linkedArtCachePath, JSON.stringify(cachedData, null, 2), 'utf-8');
                        // Find objectTitle in objectData
                        let objectTitle;
                        objectTitle = await findObjectTitle(objectData, primaryNameUris, enUris, ['primaryAndEn', 'primary', 'other']);
                        // Find accession in objectData
                        let accession;
                        accession = await findAccession(objectData, accessionUris);
                        // Find creditLine in objectData
                        let creditLine
                        creditLine = await findLinguisticObject(objectData, creditLineUris, 'Credit line');

                        // Find creator in the objectData
                        let creator;
                        if (Object.values(keyValuePairs).includes('creator')) {
                            creator = await findCreator(objectData, primaryNameUris, enUris, ['primaryAndEn', 'primary', 'other']);
                        }

                        // Find object type in the objectData
                        let type;
                        if (Object.values(keyValuePairs).includes('type')) {
                            type = await findObjectType(objectData, objectTypeUris, primaryNameUris, enUris, ['primaryAndEn', 'primary']);
                        }
                        
                        // Find citations in objectData
                        let citations;
                        if (Object.values(keyValuePairs).includes('citations')) {
                            citations = await findCitations(objectData, citationUris);
                        }
                        // Find year in objectData
                        let year;
                        if (Object.values(keyValuePairs).includes('year')) {
                            year = await findYear(objectData, keyValuePairs);
                        }
                        
                        // Find accessStatement in objectData
                        let accessStatement;
                        if (Object.values(keyValuePairs).includes('accessStatement')) {
                            accessStatement = await findLinguisticObject(objectData, accessStatementUris, 'Access statement');
                        }
                        // Find webPage in objectData
                        let webPage;
                        if (Object.values(keyValuePairs).includes('webPage')) {
                            webPage = await findWebPage(objectData, webPageUris);
                        }
                        // Find thumbnailImg in objectData
                        let thumbnailImg;
                        if (Object.values(keyValuePairs).includes('thumbnailImg')) {
                            thumbnailImg = await findThumbnailUri(objectData, thumbnailUris)
                        }
                        // Find description in objectData
                        let description;
                        if (Object.values(keyValuePairs).includes('description')) {
                            description = await findDescription(objectData, descriptionUris, enUris, ['primaryAndEn', 'primary']);
                        }

                        // Find dimensions statement in objectData
                        let dimensions;
                        if (Object.values(keyValuePairs).includes('dimensions')) {
                            dimensions = await findLinguisticObject(objectData, dimensionsStatementUris);
                            if (!dimensions) {
                                dimensions = await findDimensions(objectData);
                            }
                        }

                        // Find materials statement in objectData
                        let materials;
                        if (Object.values(keyValuePairs).includes('materials')) {
                            materials = await findLinguisticObject(objectData, materialsStatementUris);
                        }

                        // Find access statement in objectData
                        let access;
                        if (Object.values(keyValuePairs).includes('access')) {
                            access = await findLinguisticObject(objectData, accessStatementUris);
                        }

                        // Find provenance in objectData
                        let provenance;
                        if (Object.values(keyValuePairs).includes('provenance')) {
                            provenance = await findLinguisticObject(objectData, provenanceUris);
                        }

                        // Find period in objectData
                        let period;
                        if (Object.values(keyValuePairs).includes('period')) {
                            period = await findLinguisticObject(objectData, periodUris)
                        }

                        // Find findSpot in objectData
                        let encounterPlace;
                        if (Object.values(keyValuePairs).includes('encounterPlace')) {
                            encounterPlace = await findFindSpot(objectData, primaryNameUris)
                        }

                        // Find set in objectData
                        let set;
                        if (Object.values(keyValuePairs).includes('set')) {
                            set = await findSet(objectData, primaryNameUris)
                        }

                        // Find owner in objectData
                        let owner;
                        if (Object.values(keyValuePairs).includes('owner')) {
                            owner = await findOwner(objectData, primaryNameUris)
                        }

                        // Find location in objectData
                        let location;
                        if (Object.values(keyValuePairs).includes('location')) {
                            location = await findLocation(objectData, primaryNameUris)
                        }

                        // Find location in objectData
                        let tookPlaceAt;
                        if (Object.values(keyValuePairs).includes('tookPlaceAt')) {
                            tookPlaceAt = await findTookPlaceAt(objectData, primaryNameUris)
                        }

                        // Find encountered by in objectData
                        let encounteredBy;
                        if (Object.values(keyValuePairs).includes('encounteredBy')) {
                            encounteredBy = await findEncounteredBy(objectData, primaryNameUris, enUris, ['primaryAndEn', 'primary', 'other'])
                        }

                        // Generate a new ID if not provided
                        let objectId;
                        if (id1 === 'accession') {
                            if (!accession) {
                                throw new Error('Accession number not found.');
                            }
                            objectId = accession;
                        } else if (!id1) {
                            if (!objectsYaml.object_list) {
                                objectsYaml.object_list = [];
                                try {
                                    fs.writeFileSync('./content/_data/objects.yaml', yaml.dump(objectsYaml), 'utf8');
                                } catch (e) {
                                    console.error('Failed to write objects.yaml:', e);
                                }
                                objectId = 1;
                            } else {
                                const existingIds = objectsYaml.object_list.map(obj => parseInt(obj.id)).sort((a, b) => a - b);
                                for (let i = 1; i <= existingIds.length + 1; i++) {
                                    if (!existingIds.includes(i)) {
                                        objectId = i;
                                        break;
                                    }
                                }
                            }
                        } else {
                            if (objectsYaml.object_list.some(obj => obj.id.toString() === id1.toString())) {
                                console.log(`A record with the id ${id1} already exists.`);
                                break;
                            }
                            objectId = id1;
                        }
                        const metadata = {};
                        metadata['id'] = objectId;
                        metadata['title'] = objectTitle;
                        // Iterate through keyValuePairs and add fields to metadata if they exist
                        for (const [field, variable] of Object.entries(keyValuePairs)) {
                            // Check if the variable exists and is not an empty array
                            if (typeof eval(variable) !== 'undefined' && !(Array.isArray(eval(variable)) && eval(variable).length === 0)) {
                                metadata[field] = eval(variable);
                            }
                        }
                        metadata['figure'] = [];

                        // Check if the cache file exists
                        let cache;
                        try {
                            const cacheData = fs.readFileSync(figureCachePath, 'utf8');
                            cache = JSON.parse(cacheData);
                        } catch (error) {
                            // If cache file doesn't exist, create an empty cache object
                            cache = {};
                            fs.writeFileSync(figureCachePath, '{}'); // Create the cache file
                        }

                        // Handle empty figures.yaml
                        if (!figuresYaml || 
                            !figuresYaml.figure_list || 
                            figuresYaml.figure_list.length === 0 || 
                            (figuresYaml.figure_list.length === 1 && 
                                (!figuresYaml.figure_list[0] || 
                                !figuresYaml.figure_list[0].id || 
                                figuresYaml.figure_list[0].id.trim() === '' ||
                                figuresYaml.figure_list[0].id.trim() === '-'))
                        ) {
                            figuresYaml = { figure_list: [] };
                        }

                        // Extract image URI
                        let imageUri;
                        try {
                            imageUri = await findImageUri(iiifManifestData);
                        } catch (error) {
                            console.error(`Image URI not found in IIIF manifest.`);
                        }

                        // Ensure imageUri is defined before proceeding
                        if (imageUri && options.resize) {
                            try {
                                imageUri = await resizeImage(iiifManifestData, options, imageUri);
                            } catch (error) {
                                console.error(`Error occurred while resizing image.`);
                            }
                        }

                        // Initialize existingFigure
                        let existingFigure;

                        // Check if figure_list in figures.yaml exists and contains valid entries
                        if (figuresYaml && figuresYaml.figure_list && Array.isArray(figuresYaml.figure_list)) {
                            try {
                                // Look for figure with the given uri
                                existingFigure = figuresYaml.figure_list.find(fig => fig.uri === uri);
                            } catch {
                                // Catch and let existingFigure remain undefined if 'cannot read properties of null (reading 'uri')'
                                // This usually means figure_list exists but contains an empty array
                            }
                        }

                        let imageResponseFile;
                        let imageBuffer;
                        let imageHash;

                        if (imageUri) {
                            try {
                                imageResponseFile = await fetch(imageUri);
                                imageBuffer = await imageResponseFile.buffer();
                                imageHash = hashBuffer(imageBuffer);
                                // Check if the image hash already exists in the cache
                                if (cache[imageHash]) {
                                    // If the image hash exists, use the cached figure ID
                                    figureId = cache[imageHash];
                                    console.log(`Figure already in figures folder. Using file name '${cache[imageHash]}' as figure ID.`);
                                } else {
                                    // Check if an existing figure with the same URI is found in figures.yaml
                                    if (existingFigure) {
                                        // If an existing figure is found, use its ID
                                        figureId = existingFigure.id;
                                        console.log('Figure with corresponding URI found in figures.yaml. Using existing figure ID.');
                                    } else if (id1 === 'accession') {
                                        // If the object ID type is 'accession', use the accession number as the figure ID
                                        if (!accession) {
                                            throw new Error('Accession number not found.');
                                        }
                                        figureId = accession;
                                    } else {
                                        // Generate a new figure ID based on object information
                                        if (objectId) {
                                            // Construct the potential figureId
                                            const potentialFigureId = `cat-${objectId}`;
                                        
                                            // Check if the potentialFigureId already exists in figuresYaml.figure_list
                                            let idExists;
                                            try {
                                                idExists = figuresYaml.figure_list.some(figure => figure.id === potentialFigureId);
                                            } catch {
                                            }
                                        
                                            if (!idExists) {
                                                // If the ID does not exist, use it
                                                figureId = potentialFigureId;
                                            } else {
                                                console.log(`The figure ID '${potentialFigureId}' already exists. Generating figure ID based on object title instead.`);
                                                // Otherwise, generate a new ID based on object title
                                                let existingFigureIds;
                                                if (figuresYaml && figuresYaml.figure_list && Array.isArray(figuresYaml.figure_list)) {
                                                    existingFigureIds = figuresYaml.figure_list.map(fig => fig.id);
                                                }
                                                // Remove punctuation and convert spaces to hyphens
                                                let baseId = `cat-${objectTitle.toLowerCase().replace(/[^\w\s]|_/g, '').replace(/\s+/g, '-')}`;
                                                let suffix = '';
                                                if (existingFigureIds && existingFigureIds.some(id => id.startsWith(baseId))) {
                                                    let i = 1;
                                                    while (existingFigureIds.includes(`${baseId}-${String.fromCharCode(96 + i)}`)) {
                                                        i++;
                                                    }
                                                    suffix = `-${String.fromCharCode(96 + i)}`;
                                                }
                                                figureId = `${baseId}${suffix}`;
                                            }
                                        }
                                    }
                                }
                            } catch (error) {
                                console.error(`Error fetching image for object ID ${objectId}: ${error.message}`);
                            }
                        } else {
                            console.log(`No image found for object ID ${objectId}.`);
                        }
                        metadata['figure'] = figureId;
                        const figure_metadata = {
                            id: figureId,
                            src: `figures/${figureId}.jpg`,
                            caption: `${objectTitle}.`,
                            //credit: `${creditLine}`,
                            accession: accession,
                            uri: uri
                        };

                        // Log or push object and figure metadata
                        if (options.dryRun) {
                            console.log('objects.yaml entry:');
                            console.log(metadata);
                            console.log('figures.yaml entry:')
                            console.log(figure_metadata);
                        } else {
                            objectsYaml.object_list.push(metadata);

                            // Sort objects by ID
                            objectsYaml.object_list.sort((a, b) => parseInt(a.id) - parseInt(b.id));
                            
                            try {
                                // Add figure ID to the figure field of the object
                                const objectIndex = objectsYaml.object_list.findIndex(obj => obj [config.objectFieldNames.uri] === uri);

                                if (objectIndex !== -1) {
                                    if (!Array.isArray(objectsYaml.object_list[objectIndex].figure)) {
                                        objectsYaml.object_list[objectIndex].figure = [];
                                    }
                                    objectsYaml.object_list[objectIndex].figure.push({ id: figureId });
                                } else {
                                    throw new Error(`Object with linked art URI ${uri} not found in objects.yaml.`);
                                }

                            } catch (error) {
                                console.error(`Error adding figure ID to objects.yaml for object ID ${objectId}: ${error.message}`);
                            }
                    
                            if (imageBuffer) {
                                if (!existingFigure) {
                                    figuresYaml.figure_list.push(figure_metadata);
                                    }

                                // Update the cache with the new image hash
                                cache[imageHash] = figureId;
                                fs.writeFileSync(figureCachePath, JSON.stringify(cache, null, 2));
                        
                                // Update figures.yaml
                                fs.writeFileSync('./content/_data/figures.yaml', yaml.dump(figuresYaml));
                        
                                // Save image file
                                console.log(`Downloading image to project's figures folder...`);
                                const imagePath = `./content/_assets/images/figures/${figureId}.jpg`;
                                fs.writeFileSync(imagePath, imageBuffer);
                            }

                            // Save the modified objects back to objects.yaml
                            fs.writeFileSync('./content/_data/objects.yaml', yaml.dump(objectsYaml));
                            console.log(`Linked Art added successfully. Object ID: ${objectId}. Figure ID: ${figureId}.`);
                        }
                    }
            
                    if (thing === 'object.figure') {
                        // Validate the object field names
                        validateObjectFieldNames(config);

                        // Check if object ID is provided
                        if (!id1) {
                            throw new Error(`Object ID must be provided.`);
                        }
                    
                        // Check if the object ID exists in objects.yaml
                        const objectIndex = objectsYaml.object_list.findIndex(obj => obj.id.toString() === id1.toString());
                        if (objectIndex === -1) {
                            throw new Error(`Object with ID ${id1} not found in objects.yaml.`);
                        }

                        // Handle empty figures.yaml
                        if (!figuresYaml || 
                            !figuresYaml.figure_list || 
                            figuresYaml.figure_list.length === 0 || 
                            (figuresYaml.figure_list.length === 1 && 
                                (!figuresYaml.figure_list[0] || 
                                !figuresYaml.figure_list[0].id || 
                                figuresYaml.figure_list[0].id.trim() === '' ||
                                figuresYaml.figure_list[0].id.trim() === '-'))
                        ) {

                            figuresYaml = { figure_list: [] };
                        }
                        
                        // Initialize figureId
                        let figureId;

                        // Initialize linked-art.json cache
                        let cachedData = {};

                        // Initialize variables for additional responses
                        let objectData, iiifManifestData;

                        try {
                            const cacheContent = await fs.promises.readFile(linkedArtCachePath, 'utf-8');
                            cachedData = JSON.parse(cacheContent);
                        } catch (error) {
                            if (error.code !== 'ENOENT') {
                                throw error; // Rethrow the error if it is not related to file not found
                            }
                        }

                        // If the provided URI is already in cache, retrieve data from cache
                        if (uri in cachedData && !options['force']) {
                            console.log('Retrieving Linked Art from cache...');
                            objectData = cachedData[uri].objectData;
                            iiifManifestData = cachedData[uri].iiifManifestData;
                        }
                    
                        // Get objectData
                        if (!objectData) {
                            objectData = await getObjectData(linkedArtCachePath, uri, options);
                        }                                 
                    
                        iiifManifestData = await findIIIFManifest(objectData);

                        // Store fetched data in the cache file
                        cachedData[uri] = { objectData, iiifManifestData };
                        await fs.promises.writeFile(linkedArtCachePath, JSON.stringify(cachedData, null, 2), 'utf-8');

                        // Find objectTitle in objectData
                        let objectTitle;
                        objectTitle = await findObjectTitle(objectData, primaryNameUris, enUris, ['primaryAndEn', 'primary', 'other']);

                        // Find accession in objectData
                        let accession;
                        accession = await findAccession(objectData, accessionUris);

                        // Find creditLine in objectData
                        let creditLine
                        creditLine = await findLinguisticObject(objectData, creditLineUris, 'Credit line');

                        // Check if the cache file exists
                        let cache;
                        try {
                            const cacheData = fs.readFileSync(figureCachePath, 'utf8');
                            cache = JSON.parse(cacheData);
                        } catch (error) {
                            // If cache file doesn't exist, create an empty cache object
                            cache = {};
                            fs.writeFileSync(figureCachePath, '{}'); // Create the cache file
                        }

                        // Extract image URI
                        let imageUri;
                        try {
                            imageUri = await findImageUri(iiifManifestData);
                        } catch (error) {
                            console.error(`Image URI not found in IIIF manifest.`);
                        }

                        // Ensure imageUri is defined before proceeding
                        if (imageUri && options.resize) {
                            try {
                                imageUri = await resizeImage(iiifManifestData, options, imageUri);
                            } catch (error) {
                                console.error(`Error occurred while resizing image.`);
                            }
                        }

                        // Initialize existingFigure
                        let existingFigure;

                        // Check if figure_list in figures.yaml exists and contains valid entries
                        if (figuresYaml && figuresYaml.figure_list && Array.isArray(figuresYaml.figure_list)) {
                            try {
                                // Look for figure with the given uri
                                existingFigure = figuresYaml.figure_list.find(fig => fig.uri === uri);
                            } catch {
                                // Catch and let existingFigure remain undefined if 'cannot read properties of null (reading 'uri')'
                                // This usually means figure_list exists but contains an empty array
                            }
                        }

                        let imageResponseFile;
                        let imageBuffer;
                        let imageHash;

                        if (imageUri) {
                            imageResponseFile = await fetch(imageUri);
                            imageBuffer = await imageResponseFile.buffer();
                            imageHash = hashBuffer(imageBuffer);
                            // Check if the image hash already exists in the cache
                            if (cache[imageHash]) {
                                // If the image hash exists, use the cached figure ID
                                figureId = cache[imageHash];
                                console.log(`Figure already in figures folder. Using file name '${cache[imageHash]}' as figure ID.`);
                            } else {
                                // Check if the figure ID is already included in the list of figures of the object
                                if (objectsYaml.object_list[objectIndex].figure.some(figure => figure.id === figureId)) {
                                    console.log("Figure already included in the object's list of figures.");
                                    return;
                                } else if (existingFigure) {
                                    // If an existing figure is found, use its ID
                                    figureId = existingFigure.id;
                                    console.log('Figure with corresponding URI found in figures.yaml. Using existing figure ID.');
                                } else if (id2 && id2 != 'accession') {
                                    // If the user provides id2, use it as the figure ID
                                    figureId = `cat-${id2}`;
                                } else if (id2 === 'accession') {
                                    // If the user enters 'accession' as id2, use the accession number as the figure ID
                                    if (!accession) {
                                        throw new Error('Accession number not found.');
                                    }
                                    figureId = `cat-${accession}`;
                                } else {
                                    // Generate figure ID with suffix if necessary
                                    let figureBaseId = `cat-${id1}`;
                                    let suffix = 'b';
                                    let existingSuffixes = figuresYaml.figure_list
                                        .filter(fig => fig.id.startsWith(figureBaseId))
                                        .map(fig => fig.id.replace(`${figureBaseId}-`, ''));
                                    while (existingSuffixes.includes(suffix)) {
                                        // If the figure ID already exists, increment the suffix alphabetically
                                        suffix = String.fromCharCode(suffix.charCodeAt(0) + 1);
                                    }
                                    figureId = `${figureBaseId}-${suffix}`;
                                }
                            }
                        }
                        // Add figure ID to the figure field of the object
                        if (!objectsYaml.object_list[objectIndex].figure) {
                            objectsYaml.object_list[objectIndex].figure = [];
                        }

                        if (!objectsYaml.object_list[objectIndex].figure.some(figure => figure.id === figureId)) {
                            objectsYaml.object_list[objectIndex].figure.push({ id: figureId });
                        }

                        const metadata = objectsYaml.object_list[objectIndex];

                        const figure_metadata = {
                            id: figureId,
                            src: `figures/${figureId}.jpg`,
                            caption: `${objectTitle}.`,
                            //credit: `${creditLine}`,
                            accession: accession,
                            uri: uri
                        }

                        // Log or push object and figure metadata
                        if (options.dryRun) {
                            console.log('objects.yaml entry:');
                            console.log(metadata);
                            console.log('figures.yaml entry:')
                            console.log(figure_metadata);
                        } else {
                            // Save image file
                            console.log(`Downloading image to project's figures folder...`);
                            const imagePath = `./content/_assets/images/figures/${figureId}.jpg`;
                            fs.writeFileSync(imagePath, imageBuffer);

                            // Update the cache with the new image hash
                            cache[imageHash] = figureId;
                            fs.writeFileSync(figureCachePath, JSON.stringify(cache, null, 2));

                            // Add image to figures.yaml
                            if (!existingFigure) {
                                // Add image to figures.yaml
                                figuresYaml.figure_list.push(figure_metadata);
                            }

                            // Update figures.yaml
                            fs.writeFileSync('./content/_data/figures.yaml', yaml.dump(figuresYaml));

                            // Write back the updated objects.yaml file
                            fs.writeFileSync('./content/_data/objects.yaml', yaml.dump(objectsYaml));
                            console.log(`Figure added to object in objects.yaml successfully. Object ID: ${id1}. Figure ID: ${figureId}.`);
                        }
                    }            

                    if (thing === 'figure') {
                        // Validate the object field names
                        validateObjectFieldNames(config);

                        // Handle empty figures.yaml
                        if (!figuresYaml || 
                            !figuresYaml.figure_list || 
                            figuresYaml.figure_list.length === 0 || 
                            (figuresYaml.figure_list.length === 1 && 
                                (!figuresYaml.figure_list[0] || 
                                !figuresYaml.figure_list[0].id || 
                                figuresYaml.figure_list[0].id.trim() === '' ||
                                figuresYaml.figure_list[0].id.trim() === '-'))
                        ) {
                            figuresYaml = { figure_list: [] };
                        }

                        // Initialize figureId
                        let figureId;

                        // Initialize linked-art.json cache
                        let cachedData = {};

                        // Initialize variables for additional responses
                        let objectData, iiifManifestData;

                        try {
                            const cacheContent = await fs.promises.readFile(linkedArtCachePath, 'utf-8');
                            cachedData = JSON.parse(cacheContent);
                        } catch (error) {
                            if (error.code !== 'ENOENT') {
                                throw error; // Rethrow the error if it is not related to file not found
                            }
                        }

                        // If the provided URI is already in cache, retrieve data from cache
                        if (uri in cachedData && !options['force']) {
                            console.log('Retrieving Linked Art from cache...');
                            objectData = cachedData[uri].objectData;
                            iiifManifestData = cachedData[uri].iiifManifestData;
                        }

                        // Get objectData
                        if (!objectData) {
                            objectData = await getObjectData(linkedArtCachePath, uri, options);
                        }                                 

                        iiifManifestData = await findIIIFManifest(objectData);

                        // Store fetched data in the cache file
                        cachedData[uri] = { objectData, iiifManifestData };
                        await fs.promises.writeFile(linkedArtCachePath, JSON.stringify(cachedData, null, 2), 'utf-8');

                        // Find objectTitle in objectData
                        let objectTitle;
                        objectTitle = await findObjectTitle(objectData, primaryNameUris, enUris, ['primaryAndEn', 'primary', 'other']);

                        // Find accession in objectData
                        let accession;
                        accession = await findAccession(objectData, accessionUris);

                        // Find creditLine in objectData
                        let creditLine
                        creditLine = await findLinguisticObject(objectData, creditLineUris, 'Credit line');

                        // Check if the cache file exists
                        let cache;
                        try {
                            const cacheData = fs.readFileSync(figureCachePath, 'utf8');
                            cache = JSON.parse(cacheData);
                        } catch (error) {
                            // If cache file doesn't exist, create an empty cache object
                            cache = {};
                            fs.writeFileSync(figureCachePath, '{}'); // Create the cache file
                        }

                        // Extract image URI
                        let imageUri;
                        try {
                            imageUri = await findImageUri(iiifManifestData);
                        } catch (error) {
                            console.error(`Image URI not found in IIIF manifest.`);
                        }

                        // Ensure imageUri is defined before proceeding
                        if (imageUri && options.resize) {
                            try {
                                imageUri = await resizeImage(iiifManifestData, options, imageUri);
                            } catch (error) {
                                console.error(`Error occurred while resizing image.`);
                            }
                        }

                        // Initialize existingFigure
                        let existingFigure;

                        // Check if figure_list in figures.yaml exists and contains valid entries
                        if (figuresYaml && figuresYaml.figure_list && Array.isArray(figuresYaml.figure_list)) {
                            try {
                                // Look for figure with the given uri
                                existingFigure = figuresYaml.figure_list.find(fig => fig.uri === uri);
                            } catch {
                                // Catch and let existingFigure remain undefined if 'cannot read properties of null (reading 'uri')'
                                // This usually means figure_list exists but contains an empty array
                            }
                        }

                        let imageResponseFile;
                        let imageBuffer;
                        let imageHash;

                        if (imageUri) {
                            imageResponseFile = await fetch(imageUri);
                            imageBuffer = await imageResponseFile.buffer();
                            imageHash = hashBuffer(imageBuffer);
                            // Check if the image hash already exists in the cache
                            if (cache[imageHash]) {
                                // If the image hash exists, use the cached figure ID
                                figureId = cache[imageHash];
                                console.log(`Figure already in figures folder. Using file name '${cache[imageHash]}' as figure ID.`);
                            } else {
                                // Generate a new figure ID
                                if (id1 === 'accession') {
                                    if (!accession) {
                                        throw new Error('Accession number not found.');
                                    }
                                    figureId = accession;
                                } else if (!id1) {
                                    // Calculate the next available figure ID
                                    const existingIds = figuresYaml.figure_list.map(fig => fig.id);
                                    let maxId = 0;
                                    for (const id of existingIds) {
                                        const numericId = parseInt(id);
                                        if (!isNaN(numericId) && numericId > maxId) {
                                            maxId = numericId;
                                        }
                                    }
                                    figureId = maxId + 1;
                                } else {
                                    if (figuresYaml.figure_list.some(fig => fig.id.toString() === id1.toString())) {
                                        console.log(`A record with the id ${id1} already exists.`);
                                        return;
                                    }
                                    figureId = id1;
                                }
                            }
                        }

                        const figure_metadata = {
                            id: figureId.toString(),
                            src: `figures/${figureId}.jpg`,
                            caption: `${objectTitle}.`,
                            //credit: `${creditLine}`,
                            accession: accession,
                            uri: uri
                        }

                        // Log or push object and figure metadata
                        if (options.dryRun) {
                            console.log('figures.yaml entry:')
                            console.log(figure_metadata);
                        } else {
                            // Save image file
                            console.log(`Downloading image to project's figures folder...`);
                            const imagePath = `./content/_assets/images/figures/${figureId}.jpg`;
                            fs.writeFileSync(imagePath, imageBuffer);

                            // Update the cache with the new image hash
                            cache[imageHash] = figureId;
                            fs.writeFileSync(figureCachePath, JSON.stringify(cache, null, 2));

                            // Add image to figures.yaml
                            if (!existingFigure) {
                                // Add image to figures.yaml
                                figuresYaml.figure_list.push(figure_metadata);
                            }

                            // Update figures.yaml
                            fs.writeFileSync('./content/_data/figures.yaml', yaml.dump(figuresYaml));
                            console.log(`Figure added to figures.yaml successfully. Figure ID: ${figureId}.`);
                        }
                    }                 
                    
                    if (thing === 'spreadsheet') {
                        // Get objectData
                        const objectData = await getObjectData(linkedArtCachePath, uri, options);

                        // Find objectTitle in objectData
                        let fileName = await findObjectTitle(objectData, primaryNameUris, enUris, ['primaryAndEn', 'primary', 'other']);
                        if (fileName) {
                            fileName = fileName
                                .toLowerCase()                   // Convert to lowercase
                                .replace(/\s+/g, '_')            // Replace whitespace with underscores
                                .replace(/[^\w\s-]/g, '')        // Remove non-word characters except whitespace and hyphens
                                .replace(/^-+/g, '')             // Trim leading hyphens
                                .replace(/-+$/g, '');            // Trim trailing hyphens
                        } else {
                            console.log('Failed to fetch object title.');
                        }

                        // Check if spreadsheet for the object has already been created
                        const filePath = path.join(process.cwd(), `${fileName}_data.csv`);
                        fs.access(filePath, fs.constants.F_OK, (err) => {
                            if (err) {
                              if (err.code === 'ENOENT') {
                                // Spreadsheet does not already exist. Proceeding.
                              }
                            } else {
                              console.log(`${filePath} already exists`);
                              process.exit(1);
                            }
                          });

                        // Function to flatten the JSON-LD object into key-value pairs
                        async function flattenJsonLd(jsonLd) {
                            const flattened = {};

                            // Helper function to recursively flatten objects
                            function flatten(obj, prefix = '') {
                                for (const key in obj) {
                                    if (typeof obj[key] === 'object') {
                                        flatten(obj[key], `${prefix}${key}_`);
                                    } else {
                                        flattened[`${prefix}${key}`] = obj[key];
                                    }
                                }
                            }

                            flatten(jsonLd);
                            return flattened;
                        }

                        // Call the function to flatten the JSON-LD
                        const flattenedData = await flattenJsonLd(objectData);

                        // Convert flattened data to CSV format
                        let csvContent = 'Field,Content\n'; // Header line

                        // Generate CSV rows with key and value columns
                        for (const key in flattenedData) {
                            let value = flattenedData[key].toString();
                            if (value.startsWith('http')) {
                                try {
                                    const valueData = await fetchData(value);
                                    const valueTitle = findPrimaryName(valueData, primaryNameUris);
                                    value = valueTitle ? valueTitle : value;
                                } catch (error) {
                                    continue;
                                }
                            }
                            value = value.includes(',') ? `"${value}"` : value; // Enclose value in quotes if it contains a comma
                            csvContent += `${key},${value}\n`;
                        }

                        // Find objectTitle in objectData
                        (async () => {             
                            // Write CSV content to a file
                            fs.writeFileSync(`${fileName}_data.csv`, csvContent, 'utf8');
                            console.log('CSV file generated successfully.');
                        })();

                        const valueDataType = objectData['type']

                        // Mapping of data types to documentation URLs
                        const documentationUrls = {
                            HumanMadeObject: 'https://linked.art/api/1.0/endpoint/physical_object/',
                            DigitalObject: 'https://linked.art/api/1.0/endpoint/digital_object/',
                            Activity: 'https://linked.art/api/1.0/endpoint/event/',
                            // Add more data types and their documentation URLs as needed
                        };

                        // Function to get documentation URL based on data type
                        function getDocumentationUrl(dataType) {
                            return documentationUrls[dataType] || 'Documentation link not available for this data type.';
                        }

                        // Provide link to documentation
                        const documentationLink = getDocumentationUrl(valueDataType);
                        console.log(`For help interpreting the fields, see Linked Art documentation for ${valueDataType} here: ${documentationLink}`);
                    }
                }
            }
        } catch (error) {
            if (error.code === 'ENOTFOUND') {
                console.error(`Failed to fetch Linked Art. Could not resolve hostname. Please check your network connection and try again.`);
            } else {
                console.log(`Failed to fetch Linked Art. ${error.message}`);
            }
        }
    }
}