#!/usr/bin/env ruby
# frozen_string_literal: true

require 'json'
require 'open3'

ROOT_DIR = File.expand_path(File.dirname(__FILE__))
KEYS_DIR = File.join(ROOT_DIR, 'keys')
FLOW_JSON = File.join(ROOT_DIR, 'flow.json')
ACTORS = %w[flow-admin].freeze

def sh!(cmd, in_dir: ROOT_DIR)
  stdout, stderr, status = Open3.capture3(cmd, chdir: in_dir)
  raise "Command failed (#{status.exitstatus}): #{cmd}\n#{stderr}" unless status.success?
  stdout
end

def ensure_prereqs!
  raise "Missing flow.json at #{FLOW_JSON}" unless File.file?(FLOW_JSON)
  Dir.mkdir(KEYS_DIR) unless Dir.exist?(KEYS_DIR)
  # verify flow cli
  sh!('flow version')
end

def parse_keygen(out)
  priv = out[/Private Key\s+([0-9a-fA-F]+)/, 1]
  pub = out[/Public Key\s+([0-9a-fA-F]+)/, 1]
  raise 'failed to parse generated keys' unless priv && pub
  [priv, pub]
end

def parse_created_address(out)
  addr = out[/Address\s+0x([0-9a-fA-F]+)/, 1]
  raise 'failed to parse created address' unless addr
  addr
end

def flow_account_exists?(hex_addr)
  begin
    sh!("flow accounts get --network emulator 0x#{hex_addr}")
    true
  rescue
    false
  end
end

def ensure_keypair(name)
  pub_path = File.join(KEYS_DIR, "#{name}.pub")
  pkey_path = File.join(KEYS_DIR, "#{name}.pkey")
  return if File.file?(pub_path) && File.file?(pkey_path)

  puts "[keygen] #{name}"
  out = sh!('flow keys generate --network emulator')
  priv, pub = parse_keygen(out)
  File.write(pkey_path, priv)
  File.write(pub_path, pub)
  puts "[ok] wrote #{pkey_path} and #{pub_path}"
end

def ensure_account(name)
  pub_path = File.join(KEYS_DIR, "#{name}.pub")
  addr_path = File.join(KEYS_DIR, "#{name}.addr")
  create_out_path = File.join(KEYS_DIR, "#{name}.create.txt")

  pub = File.read(pub_path).strip
  if File.file?(addr_path) && File.size?(addr_path)
    hex = File.read(addr_path).strip.sub(/^0x/, '')
    if flow_account_exists?(hex)
      puts "[ok] #{name} present at 0x#{hex}"
      return hex
    else
      puts "[warn] #{name} 0x#{hex} not found on emulator; recreating"
    end
  end

  puts "[acct] creating #{name}"
  out = sh!("flow accounts create --network emulator --key #{pub} --signer emulator-account")
  File.write(create_out_path, out)
  hex = parse_created_address(out)
  File.write(addr_path, "0x#{hex}")
  puts "[ok] #{name} -> 0x#{hex}"
  hex
end

def update_flow_json(addresses)
  data = JSON.parse(File.read(FLOW_JSON))
  data['accounts'] ||= {}
  addresses.each do |name, hex|
    data['accounts'][name] = {
      'address' => hex,
      'key' => { 'type' => 'file', 'location' => "keys/#{name}.pkey" }
    }
  end
  File.write(FLOW_JSON, JSON.pretty_generate(data) + "\n")
  puts '[ok] flow.json updated'
end

def main
  ensure_prereqs!
  puts "[info] Bootstrapping emulator accounts from #{KEYS_DIR}"
  addresses = {}
  ACTORS.each do |name|
    ensure_keypair(name)
    addresses[name] = ensure_account(name)
  end
  update_flow_json(addresses)
  # Setup FlowToken vaults and fund holders for dev
  begin
    setup_vault_tx = File.join(ROOT_DIR, 'cadence/transactions/setup/user/setup-flow-vault.cdc')
    fund_flow_tx = File.join(ROOT_DIR, 'cadence/transactions/setup/admin/fund-flow.cdc')

    # Ensure sender and recipients have Flow vaults
    [
      'emulator-account',
    ].each do |acct|
      puts "[tx] setup Flow vault for #{acct}"
      sh!("flow transactions send #{setup_vault_tx} --network emulator --signer #{acct}")
    end

    # Fund holders from emulator service account
    [
      'flow-admin',
      'flow-admin'
    ].each do |recipient|
      to_addr = "0x#{addresses[recipient]}"
      args = [
        { type: 'Address', value: to_addr },
        { type: 'UFix64', value: '1000.00' }
      ]
      puts "[tx] fund #{recipient} (#{to_addr}) with 1000.00 FLOW"
      sh!("flow transactions send #{fund_flow_tx} --network emulator --signer emulator-account --args-json '#{JSON.generate(args)}'")
    end
  rescue => e
    warn "[warn] funding/setup step failed: #{e.message}"
    raise
  end
  puts "[done] Summary:"
  addresses.each { |n, hex| puts "#{n} 0x#{hex}" }
end

main


