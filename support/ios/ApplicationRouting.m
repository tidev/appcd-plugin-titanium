/**
 * This code is closed source and Confidential and Proprietary to
 * Appcelerator, Inc. All Rights Reserved.  This code MUST not be
 * modified, copied or otherwise redistributed without express
 * written permission of Appcelerator. This file is licensed as
 * part of the Appcelerator Platform and governed under the terms
 * of the Appcelerator license agreement.
 * Copyright (c) 2015 Appcelerator, Inc. All Rights Reserved.
 */
#import <Foundation/Foundation.h>
#import <CommonCrypto/CommonDigest.h>
#import "ApplicationRouting.h"
#import <zlib.h>

#define initializeAppData   icucfasf7797nnzz
#define filterAppData       sdnmnciuuu66zzaq

extern NSString * const TI_APPLICATION_GUID;
extern NSData * filterAppData (NSString *filename, NSData * thedata);
extern void initializeAppData (NSString * sha1);

/**
 * gunzip NSData and return as NSData
 */
static NSData* gunzip(NSData *data) {
	z_stream zStream;
	memset(&zStream, 0, sizeof(zStream));
	inflateInit2(&zStream, 16);

	UInt32 nUncompressedBytes = *(UInt32*)(data.bytes + data.length - 4);
	NSMutableData* gunzippedData = [NSMutableData dataWithLength:nUncompressedBytes];

	zStream.next_in = (Bytef*)data.bytes;
	zStream.avail_in =(uInt) data.length;
	zStream.next_out = (Bytef*)gunzippedData.bytes;
	zStream.avail_out = (uInt)gunzippedData.length;

	inflate(&zStream, Z_FINISH);
	inflateEnd(&zStream);

	return gunzippedData;
}

/**
 * return a char* as hex NSString*
 */
static NSString* toHexString(unsigned char* data, unsigned int length) {
	NSMutableString* hash = [NSMutableString stringWithCapacity:length * 2];
	for (unsigned int i = 0; i < length; i++) {
		[hash appendFormat:@"%02x", data[i]];
		data[i] = 0;
	}
	return hash;
}

/**
 * sha1 a NSString
 */
static NSString* sha1Str(NSString *data) {
	unsigned int outputLength = CC_SHA1_DIGEST_LENGTH;
	unsigned char output[outputLength];
	CC_LONG length = (CC_LONG)[data lengthOfBytesUsingEncoding:NSUTF8StringEncoding];
	CC_SHA1([data UTF8String], length, output);
	return toHexString(output,outputLength);
}

/**
 * sha1 a NSData
 */
static NSData* sha1Data(NSData *data) {
	unsigned int outputLength = CC_SHA1_DIGEST_LENGTH;
	unsigned char output[outputLength];
	CC_SHA1(data.bytes, (unsigned int) data.length, output);
	NSString *str = toHexString(output,outputLength);
	return [str dataUsingEncoding:NSUTF8StringEncoding];
}

@implementation ApplicationRouting

+ (void) initialize {
	NSError *error = nil;
	NSString *dirsha = sha1Str(TI_APPLICATION_GUID);
	NSString *dirPath = [[[NSBundle mainBundle] resourcePath] stringByAppendingPathComponent:dirsha];
	NSArray *directoryContents = [[NSFileManager defaultManager] contentsOfDirectoryAtPath:dirPath error:&error];
#if !TARGET_OS_IPHONE && TARGET_IPHONE_SIMULATOR
	NSLog(@"[INFO] ApplicationRouting initialize, dirPath=%@",dirPath);
#endif
	if (error==nil && [directoryContents count] > 0) {
		// sort the files alphabetically
		directoryContents = [directoryContents sortedArrayUsingSelector:@selector(localizedCaseInsensitiveCompare:)];
		NSMutableData *shadata = [NSMutableData dataWithCapacity:CC_SHA1_DIGEST_LENGTH];
		for (NSString *filename in directoryContents) {
			NSString *filePath = [dirPath stringByAppendingPathComponent:filename];
			NSFileHandle *aHandle = [NSFileHandle fileHandleForReadingAtPath:filePath];
			NSData *contentData = [aHandle readDataToEndOfFile];
			NSData *sha = sha1Data(contentData);
			[shadata appendData:sha];
		}
		NSString *sha = [[[NSString alloc] initWithData:sha1Data(shadata) encoding:NSUTF8StringEncoding] autorelease];
#if !TARGET_OS_IPHONE && TARGET_IPHONE_SIMULATOR
		NSLog(@"[DEBUG] sha of filenames = [%@]",sha);
#endif
		initializeAppData(sha);
	}
}

+ (NSData *) resolveAppAsset:(NSString *)path {
#if !TARGET_OS_IPHONE && TARGET_IPHONE_SIMULATOR
	NSLog(@"[INFO] resolveAppAsset path %@",path);
#endif
	NSString *dirsha = sha1Str(TI_APPLICATION_GUID);
	NSString *pathsha = sha1Str(path);
	NSString *filePath = [[[[NSBundle mainBundle] resourcePath] stringByAppendingPathComponent:dirsha] stringByAppendingPathComponent:pathsha];
	NSFileHandle *aHandle = [NSFileHandle fileHandleForReadingAtPath:filePath];
	if (aHandle) {
		NSData *contentData = [aHandle readDataToEndOfFile];
		NSData *unzipData = gunzip(contentData);
		return filterAppData(path, unzipData);
	}
	
	NSLog(@"[WARN] couldn't find file %@",path);
	return nil;
}

@end
