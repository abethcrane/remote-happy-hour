provider "azurerm" {
    version = "~>2.0"
    features {}
}

resource "azurerm_resource_group" "main" {
  name     = "${var.prefix}-resources"
  location = var.location
}

# Create virtual network
resource "azurerm_virtual_network" "main" {
  name                = "${var.prefix}-network"
  address_space       = ["10.0.0.0/16"]
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
}

# Create subnet
resource "azurerm_subnet" "internal" {
  name                 = "${var.prefix}-internal"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = ["10.0.2.0/24"]
}

# Create public IP
resource "azurerm_public_ip" "main" {
  name                = "${var.prefix}-publicip"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  allocation_method   = "Static"
}

# Create Network Security Group
resource "azurerm_network_security_group" "main" {
  name                = "${var.prefix}-nsg"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
}

# Create SSH rule
resource "azurerm_network_security_rule" "ssh" {
  name                       = "${var.prefix}-ssh"
  priority                   = 1001
  direction                  = "Inbound"
  access                     = "Allow"
  protocol                   = "Tcp"
  source_port_range          = "*"
  destination_port_range     = "22"
  source_address_prefix      = "*"
  destination_address_prefix = "*"
  resource_group_name        = azurerm_resource_group.main.name
  network_security_group_name = azurerm_network_security_group.main.name
}

# Create TURN server "Listen Port" rule
# TURN listener port for UDP and TCP listeners (Default: 3478)
resource "azurerm_network_security_rule" "turnListen1" {
  name                       = "${var.prefix}-turnListen1"
  priority                   = 1002
  direction                  = "Inbound"
  access                     = "Allow"
  protocol                   = "UDP"
  source_port_range          = "*"
  destination_port_range     = "3478"
  source_address_prefix      = "*"
  destination_address_prefix = "*"
  resource_group_name        = azurerm_resource_group.main.name
  network_security_group_name = azurerm_network_security_group.main.name
}

# Create TURN server "Listen Port" rule
# TURN listener port for TLS and DTLS listeners 
resource "azurerm_network_security_rule" "turnListen2" {
  name                       = "${var.prefix}-turnListen2"
  priority                   = 1003
  direction                  = "Inbound"
  access                     = "Allow"
  protocol                   = "*"
  source_port_range          = "*"
  destination_port_range     = "5349"
  source_address_prefix      = "*"
  destination_address_prefix = "*"
  resource_group_name        = azurerm_resource_group.main.name
  network_security_group_name = azurerm_network_security_group.main.name
}

# Create network interface
resource "azurerm_network_interface" "main" {
  name                = "${var.prefix}-nic"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name

  ip_configuration {
    name                          = "nicConfiguration1"
    subnet_id                     = azurerm_subnet.internal.id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.main.id
  }
}

# Connect the security group to the network interface
resource "azurerm_network_interface_security_group_association" "main" {
    network_interface_id      = azurerm_network_interface.main.id
    network_security_group_id = azurerm_network_security_group.main.id
}

# Create (and display) an SSH key
resource "tls_private_key" "ssh" {
  algorithm = "RSA"
  rsa_bits = 4096
}
output "tls_private_key" { value = tls_private_key.ssh.private_key_pem }

# Create a Linux virtual machine
resource "azurerm_linux_virtual_machine" "main" {
  name                  = "${var.prefix}-vm"
  location              = azurerm_resource_group.main.location
  resource_group_name   = azurerm_resource_group.main.name
  network_interface_ids = [azurerm_network_interface.main.id]
  size               = "Standard_DS1_v2"

  # Uncomment this line to delete the OS disk automatically when deleting the VM
  # delete_os_disk_on_termination = true

  # Uncomment this line to delete the data disks automatically when deleting the VM
  # delete_data_disks_on_termination = true


  os_disk {
    name              = "${var.prefix}-osdisk1"
    caching           = "ReadWrite"
    storage_account_type = "Standard_LRS"
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "UbuntuServer"
    sku       = "16.04-LTS"
    version   = "latest"
  }
  
  computer_name  = var.prefix
  admin_username = var.admin_username
  admin_password = var.admin_password
  # To force access via ssh key, set this to true
  disable_password_authentication = false

  admin_ssh_key {
      username       = var.admin_username
      public_key     = tls_private_key.ssh.public_key_openssh
  }

  # Set up the turn server
  provisioner "file" {
      connection {
          type     = "ssh"
          host     = azurerm_public_ip.main.ip_address
          user     = var.admin_username
          password = var.admin_password
      }

      source      = "turnserver.sh"
      destination = "turnserver.sh"
  }

  provisioner "remote-exec" {
      connection {
          type     = "ssh"
          host     = azurerm_public_ip.main.ip_address
          user     = var.admin_username
          password = var.admin_password
      }

      inline = [
        "sudo bash turnserver.sh ${var.turn_username} ${var.turn_password}"
      ]
  }

}
