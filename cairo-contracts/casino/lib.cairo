pub mod models;
pub mod vrf;

pub mod systems {
    pub mod coin_toss;
    pub mod casino;
    pub mod event_relayer;
}

#[cfg(test)]
mod tests {
    pub mod test_coin_toss;
    pub mod test_event_relayer;
}
