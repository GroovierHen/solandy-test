use pinocchio::{
    account_info::AccountInfo, entrypoint, msg, program_error::ProgramError, pubkey::Pubkey,
    ProgramResult,
};
use pinocchio_pubkey::from_str;
use pinocchio_system::instructions::Transfer;

const DESCRIMINATOR: u8 = 0x42;

entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let rating = u64::from_le_bytes(instruction_data[0..8].try_into().unwrap());
    msg!("You rated {}/10!", rating);

    if accounts.len() < 3 {
        return Err(ProgramError::InvalidArgument);
    }

    let program_account = &accounts[0];
    if !program_account.owner().eq(program_id) {
        return Err(ProgramError::IllegalOwner);
    }
    if program_account.data_len() < 11 * 8 + 1 {
        return Err(ProgramError::InvalidAccountData);
    }

    {
        unsafe {
            let data_pointer = program_account.borrow_mut_data_unchecked() as *mut [u8] as *mut u8;
            *data_pointer = DESCRIMINATOR;
            let rating_pointer = data_pointer.add(1) as *mut u64;
            *rating_pointer.add(rating as usize) += 1;
        }
    }

    let signer = &accounts[1];
    let system_program = &accounts[2];

    if !signer.is_signer() {
        return Err(ProgramError::IncorrectAuthority);
    }
    if !system_program.key().eq(&Pubkey::default()) {
        return Err(ProgramError::IncorrectProgramId);
    }

    let authority = from_str("Andy1111111111111111111111111111111111111111");
    if signer.key().eq(&authority) {
        // this is where you want to get to

        let lamports = program_account.lamports();
        *program_account.try_borrow_mut_lamports().unwrap() = 0;

        if accounts.len() >= 4 {
            let receiver = &accounts[3];
            *receiver.try_borrow_mut_lamports().unwrap() += lamports;
        } else {
            *signer.try_borrow_mut_lamports().unwrap() += lamports;
        }
    } else {
        Transfer {
            from: &signer,
            to: program_account,
            lamports: 100_000_000,
        }
        .invoke()?;
    }

    Ok(())
}
