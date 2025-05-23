/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

export const LOGSTASH_CONFIG_PIPELINES = `- pipeline.id: elastic-agent-pipeline
  path.config: "/etc/path/to/elastic-agent-pipeline.conf"
`;

const inputSSLConfig = `
    ssl_enabled => true
    ssl_certificate_authorities => ["<ca_path>"]
    ssl_certificate => "<server_cert_path>"
    ssl_key => "<server_cert_key_in_pkcs8>"
    ssl_client_authentication => "required"`;

export function getLogstashPipeline(isSSLEnabled: boolean, apiKey?: string) {
  return `input {
  elastic_agent {
    port => 5044 ${isSSLEnabled ? inputSSLConfig : ''}
  }
}

output {
  elasticsearch {
    hosts => "<es_host>"
    api_key => "<api_key>"
    data_stream => true
    ssl_enabled => true
    # ssl_certificate_authorities => "<elasticsearch_ca_path>"
  }
}`.replace('<api_key>', apiKey || '<api_key>');
}
