import baseLogger from "../common/logger";

const frameLogger = baseLogger.sub("frame").sub(`{${location.hostname}}`);

export default frameLogger;
