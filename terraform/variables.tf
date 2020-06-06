variable "location" {}

variable "admin_username" {
    type = string
    description = "Administrator user name for virtual machine"
}

variable "admin_password" {
    type = string
    description = "Password must meet Azure complexity requirements"
}

variable "prefix" {
    type = string
    default = "my"
}

variable "turn_username" {
    type = string
    description = "Username for the turn server to be set up with"
}

variable "turn_password" {
    type = string
    description = "Password for the turn server to be set up with"
}
